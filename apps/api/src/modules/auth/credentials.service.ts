import { randomUUID } from "node:crypto";
import type { AuthPolicy } from "@hasut/config";
import type {
  AuthClientConfig,
  AuthLoginResult,
  AuthVerifyResult,
  CurrentMember,
  IdentityProviderName,
  OtpChallengeReceipt,
  PasswordResetTicket,
  PasswordUpdateResult,
} from "@hasut/types";
import { PASSWORD_MIN_LENGTH } from "@hasut/utils";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import type { ApiEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { UsersService } from "../users/users.service";
import type { AuthRequestContext } from "./auth.context";
import { AuthService } from "./auth.service";
import { resolveDestination, type OtpDestination } from "./otp-destination";
import { CAPTCHA_VERIFIER, type CaptchaVerifier } from "./providers/captcha-verifier";
import { OAUTH_REGISTRY, type OAuthRegistry } from "./providers/oauth-provider";
import { RateLimitService } from "./rate-limit.service";
import { SECRET_HASHER, type SecretHasher } from "./secret-hasher";

const RESET_TICKET_PREFIX = "auth:reset:";

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly configuration: ConfigurationService,
    private readonly audit: AuditService,
    private readonly rateLimit: RateLimitService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<ApiEnv, true>,
    @Inject(CAPTCHA_VERIFIER) private readonly captcha: CaptchaVerifier,
    @Inject(OAUTH_REGISTRY) private readonly oauth: OAuthRegistry,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
  ) {}

  async clientConfig(): Promise<AuthClientConfig> {
    const policy = await this.configuration.getAuthPolicy();
    const sso = this.oauth.enabled();
    return {
      captcha: {
        provider: this.config.get("CAPTCHA_PROVIDER", { infer: true }),
        required: this.captcha.required,
        // Publishable by design; the secret never leaves the API.
        siteKey: this.config.get("RECAPTCHA_SITE_KEY", { infer: true }),
      },
      sso: {
        google: {
          enabled: sso.google,
          clientId: this.config.get("GOOGLE_CLIENT_ID", { infer: true }),
        },
        facebook: {
          enabled: sso.facebook,
          appId: this.config.get("FACEBOOK_APP_ID", { infer: true }),
        },
      },
      passwordMinLength: this.minPasswordLength(policy),
      codeLength: policy.codeLength,
      resendCooldownSeconds: policy.resendCooldownSeconds,
    };
  }

  async register(
    input: {
      email: string;
      password: string;
      displayName: string;
      phone?: string;
      deviceId?: string;
      captchaToken?: string;
    },
    context: AuthRequestContext,
  ): Promise<AuthVerifyResult> {
    await this.captcha.assertHuman({
      token: input.captchaToken,
      action: "password_register",
      ip: context.ip,
    });
    const policy = await this.configuration.getAuthPolicy();
    this.assertPasswordMeetsPolicy(input.password, policy);

    if ((await this.users.findByEmail(input.email)) !== null) {
      throw new HasutHttpException(
        "CONFLICT",
        "An account already uses this email address",
        HttpStatus.CONFLICT,
      );
    }
    if (input.phone !== undefined && (await this.users.findByPhone(input.phone)) !== null) {
      throw new HasutHttpException(
        "CONFLICT",
        "An account already uses this phone number",
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.users.createWithEmail({
      email: input.email,
      passwordHash: await this.hasher.hash(input.password),
      displayName: input.displayName,
      phoneE164: input.phone,
      // The address is unproven until they verify it with an email code.
      emailVerified: false,
    });
    const member = this.users.toCurrentMember(created);

    await this.audit.record({
      actorId: member.id,
      action: "AUTH_REGISTERED",
      entity: "member",
      entityId: member.id,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { method: "PASSWORD" },
    });

    const tokens = await this.auth.issueSession(member, input.deviceId, context);
    return { member, tokens };
  }

  async loginWithPassword(
    input: { email: string; password: string; deviceId?: string; captchaToken?: string },
    context: AuthRequestContext,
  ): Promise<AuthLoginResult> {
    await this.captcha.assertHuman({
      token: input.captchaToken,
      action: "password_login",
      ip: context.ip,
    });
    const policy = await this.configuration.getAuthPolicy();
    await this.rateLimit.assertPasswordAttemptAllowed(input.email, context.ip, policy);

    const row = await this.users.findByEmail(input.email);
    // Same failure for unknown email and wrong password, so neither is probeable.
    if (row === null || row.passwordHash === null) {
      throw this.invalidCredentials();
    }
    if (!(await this.hasher.verify(row.passwordHash, input.password))) {
      await this.audit.record({
        actorId: row.id,
        action: "AUTH_PASSWORD_FAILED",
        entity: "member",
        entityId: row.id,
        ip: context.ip,
        requestId: context.requestId,
      });
      throw this.invalidCredentials();
    }
    this.users.assertSignInAllowed(row);

    const member = this.users.toCurrentMember(row);
    if (!member.twoFactorEnabled) {
      const tokens = await this.auth.issueSession(member, input.deviceId, context);
      await this.recordPasswordLogin(member.id, context, false);
      return { status: "AUTHENTICATED", member, tokens };
    }

    const destination = this.secondFactorDestination(row);
    const issued = await this.auth.issueChallenge({
      destination,
      purpose: "TWO_FACTOR",
      policy,
      context,
      deviceId: input.deviceId,
      memberId: row.id,
    });
    await this.recordPasswordLogin(member.id, context, true);
    return { status: "TWO_FACTOR_REQUIRED", challenge: issued.receipt };
  }

  async verifyTwoFactor(
    input: { challengeId: string; code: string; deviceId?: string },
    context: AuthRequestContext,
  ): Promise<AuthVerifyResult> {
    const pending = await this.prisma.otpChallenge.findUnique({
      where: { id: input.challengeId },
    });
    if (pending === null || pending.purpose !== "TWO_FACTOR" || pending.memberId === null) {
      throw new HasutHttpException(
        "OTP_INVALID",
        "Invalid verification code",
        HttpStatus.BAD_REQUEST,
      );
    }

    const consumed = await this.auth.consumeChallenge(input.challengeId, input.code, context);
    const row = await this.users.findWithRoles(consumed.memberId ?? "");
    if (row === null) {
      throw new HasutHttpException("NOT_FOUND", "Member not found", HttpStatus.NOT_FOUND);
    }
    this.users.assertSignInAllowed(row);

    const member = this.users.toCurrentMember(row);
    await this.audit.record({
      actorId: member.id,
      action: "AUTH_TWO_FACTOR_VERIFIED",
      entity: "member",
      entityId: member.id,
      ip: context.ip,
      requestId: context.requestId,
    });
    const tokens = await this.auth.issueSession(member, input.deviceId, context);
    return { member, tokens };
  }

  async loginWithSso(
    input: {
      provider: IdentityProviderName;
      token: string;
      deviceId?: string;
      captchaToken?: string;
    },
    context: AuthRequestContext,
  ): Promise<AuthVerifyResult> {
    await this.captcha.assertHuman({
      token: input.captchaToken,
      action: "sso_login",
      ip: context.ip,
    });
    const identity = await this.oauth.get(input.provider).verify(input.token);
    const row = await this.users.upsertBySsoIdentity({
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      email: identity.email,
      emailVerified: identity.emailVerified,
      displayName: identity.displayName,
    });
    const member = this.users.toCurrentMember(row);

    await this.audit.record({
      actorId: member.id,
      action: "AUTH_SSO_VERIFIED",
      entity: "member",
      entityId: member.id,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { provider: identity.provider },
    });

    const tokens = await this.auth.issueSession(member, input.deviceId, context);
    return { member, tokens };
  }

  /**
   * Always returns a receipt, even for an unknown destination, so the endpoint
   * cannot be used to enumerate accounts.
   */
  async forgotPassword(
    input: { phone?: string; email?: string; captchaToken?: string },
    context: AuthRequestContext,
  ): Promise<OtpChallengeReceipt> {
    await this.captcha.assertHuman({
      token: input.captchaToken,
      action: "password_forgot",
      ip: context.ip,
    });
    const destination = resolveDestination(input);
    const policy = await this.configuration.getAuthPolicy();
    await this.rateLimit.assertOtpAllowed(
      `reset:${destination.email ?? destination.phoneE164 ?? ""}`,
      context.ip,
      policy,
    );

    const row =
      destination.channel === "EMAIL"
        ? await this.users.findByEmail(destination.email ?? "")
        : await this.users.findByPhone(destination.phoneE164 ?? "");

    const issued = await this.auth.issueChallenge({
      destination,
      purpose: "PASSWORD_RESET",
      policy,
      context,
      memberId: row?.id,
      // No account means no message: the caller still gets a receipt, but we do
      // not let this endpoint text or mail an address nobody registered.
      deliver: row !== null,
    });
    return issued.receipt;
  }

  async verifyPasswordReset(
    input: { challengeId: string; code: string },
    context: AuthRequestContext,
  ): Promise<PasswordResetTicket> {
    const pending = await this.prisma.otpChallenge.findUnique({
      where: { id: input.challengeId },
    });
    if (pending === null || pending.purpose !== "PASSWORD_RESET") {
      throw new HasutHttpException(
        "OTP_INVALID",
        "Invalid verification code",
        HttpStatus.BAD_REQUEST,
      );
    }

    const consumed = await this.auth.consumeChallenge(input.challengeId, input.code, context);
    // An unknown destination still burns a code and returns a ticket shaped the
    // same way; it simply resolves to no member on redemption.
    const policy = await this.configuration.getAuthPolicy();
    const ticket = randomUUID();
    await this.redis.set(
      `${RESET_TICKET_PREFIX}${ticket}`,
      consumed.memberId ?? "",
      policy.resetTicketTtlSeconds,
    );
    return {
      ticket,
      expiresAt: new Date(Date.now() + policy.resetTicketTtlSeconds * 1000).toISOString(),
    };
  }

  async resetPassword(
    input: { ticket: string; password: string },
    context: AuthRequestContext,
  ): Promise<PasswordUpdateResult> {
    const key = `${RESET_TICKET_PREFIX}${input.ticket}`;
    const memberId = await this.redis.get(key);
    if (memberId === null) {
      throw new HasutHttpException(
        "UNAUTHENTICATED",
        "This reset link has expired. Start again.",
        HttpStatus.UNAUTHORIZED,
      );
    }
    // Single use, whether or not it resolves to an account.
    await this.redis.del(key);
    if (memberId.length === 0) {
      throw new HasutHttpException(
        "UNAUTHENTICATED",
        "This reset link has expired. Start again.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const policy = await this.configuration.getAuthPolicy();
    this.assertPasswordMeetsPolicy(input.password, policy);
    return this.applyNewPassword(memberId, input.password, context, "AUTH_PASSWORD_RESET");
  }

  async changePassword(
    memberId: string,
    input: { currentPassword: string; password: string },
    context: AuthRequestContext,
  ): Promise<PasswordUpdateResult> {
    const row = await this.users.findWithRoles(memberId);
    if (row === null) {
      throw new HasutHttpException("NOT_FOUND", "Member not found", HttpStatus.NOT_FOUND);
    }
    if (row.passwordHash === null) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "This account has no password yet. Use forgot password to set one.",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!(await this.hasher.verify(row.passwordHash, input.currentPassword))) {
      throw this.invalidCredentials();
    }

    const policy = await this.configuration.getAuthPolicy();
    this.assertPasswordMeetsPolicy(input.password, policy);
    return this.applyNewPassword(memberId, input.password, context, "AUTH_PASSWORD_CHANGED");
  }

  async setTwoFactor(
    memberId: string,
    enabled: boolean,
    context: AuthRequestContext,
  ): Promise<CurrentMember> {
    const row = await this.users.findWithRoles(memberId);
    if (row === null) {
      throw new HasutHttpException("NOT_FOUND", "Member not found", HttpStatus.NOT_FOUND);
    }
    // Without a delivery channel the second step could lock the account out.
    if (enabled && row.phoneE164 === null && row.email === null) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Add a phone number or email before enabling two-step verification",
        HttpStatus.BAD_REQUEST,
      );
    }
    const member = await this.users.setTwoFactor(memberId, enabled);
    await this.audit.record({
      actorId: memberId,
      action: enabled ? "AUTH_TWO_FACTOR_ENABLED" : "AUTH_TWO_FACTOR_DISABLED",
      entity: "member",
      entityId: memberId,
      ip: context.ip,
      requestId: context.requestId,
    });
    return member;
  }

  private async applyNewPassword(
    memberId: string,
    password: string,
    context: AuthRequestContext,
    action: string,
  ): Promise<PasswordUpdateResult> {
    await this.prisma.member.update({
      where: { id: memberId },
      data: {
        passwordHash: await this.hasher.hash(password),
        passwordUpdatedAt: new Date(),
      },
    });
    // A password change invalidates every existing session on every device.
    const revoked = await this.prisma.session.updateMany({
      where: { memberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actorId: memberId,
      action,
      entity: "member",
      entityId: memberId,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { revokedSessionCount: revoked.count },
    });
    return { updated: true, revokedSessionCount: revoked.count };
  }

  private secondFactorDestination(row: {
    phoneE164: string | null;
    email: string | null;
  }): OtpDestination {
    if (row.phoneE164 !== null) {
      return { channel: "SMS", phoneE164: row.phoneE164, email: null };
    }
    if (row.email !== null) {
      return { channel: "EMAIL", phoneE164: null, email: row.email };
    }
    throw new HasutHttpException(
      "VALIDATION_ERROR",
      "This account has no verification channel",
      HttpStatus.BAD_REQUEST,
    );
  }

  private minPasswordLength(policy: AuthPolicy): number {
    return Math.max(PASSWORD_MIN_LENGTH, policy.passwordMinLength);
  }

  private assertPasswordMeetsPolicy(password: string, policy: AuthPolicy): void {
    const min = this.minPasswordLength(policy);
    if (password.length < min) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        `Use at least ${min} characters`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private invalidCredentials(): HasutHttpException {
    return new HasutHttpException(
      "UNAUTHENTICATED",
      "Email or password is incorrect",
      HttpStatus.UNAUTHORIZED,
    );
  }

  private async recordPasswordLogin(
    memberId: string,
    context: AuthRequestContext,
    pendingSecondFactor: boolean,
  ): Promise<void> {
    await this.audit.record({
      actorId: memberId,
      action: "AUTH_PASSWORD_VERIFIED",
      entity: "member",
      entityId: memberId,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { pendingSecondFactor },
    });
  }
}
