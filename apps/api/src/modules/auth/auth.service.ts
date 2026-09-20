import { randomBytes, randomUUID } from "node:crypto";
import type { AuthPolicy } from "@hasut/config";
import type {
  AuthSessionView,
  AuthTokens,
  AuthVerifyResult,
  CurrentMember,
  LogoutAllResult,
  LogoutResult,
  OtpChallengeReceipt,
  OtpChannel,
  OtpPurpose,
} from "@hasut/types";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { OtpChallenge } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import type { ApiEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import type { AuthRequestContext } from "./auth.context";
import { OtpCodeGenerator } from "./otp-code.generator";
import {
  destinationHint,
  destinationKey,
  resolveDestination,
  type OtpDestination,
} from "./otp-destination";
import { CAPTCHA_VERIFIER, type CaptchaVerifier } from "./providers/captcha-verifier";
import { EMAIL_PROVIDER, type EmailProvider } from "./providers/email-provider";
import { OTP_PROVIDER, type OtpProvider } from "./providers/otp-provider";
import { RateLimitService } from "./rate-limit.service";
import { SECRET_HASHER, type SecretHasher } from "./secret-hasher";
import { TokenService } from "./token.service";

const REFRESH_SEPARATOR = ".";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly configuration: ConfigurationService,
    private readonly audit: AuditService,
    private readonly rateLimit: RateLimitService,
    private readonly tokens: TokenService,
    private readonly codes: OtpCodeGenerator,
    private readonly config: ConfigService<ApiEnv, true>,
    @Inject(OTP_PROVIDER) private readonly otpProvider: OtpProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(CAPTCHA_VERIFIER) private readonly captcha: CaptchaVerifier,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
  ) {}

  async requestOtp(
    input: {
      phone?: string;
      email?: string;
      purpose: OtpPurpose;
      deviceId?: string;
      captchaToken?: string;
    },
    context: AuthRequestContext,
  ): Promise<OtpChallengeReceipt> {
    await this.captcha.assertHuman({
      token: input.captchaToken,
      action: "otp_request",
      ip: context.ip,
    });
    this.assertPublicPurpose(input.purpose);
    const destination = resolveDestination(input);
    const policy = await this.configuration.getAuthPolicy();
    await this.rateLimit.assertOtpAllowed(destinationKey(destination), context.ip, policy);
    await this.assertResendAllowed(destination, input.purpose, policy);

    const issued = await this.issueChallenge({
      destination,
      purpose: input.purpose,
      policy,
      context,
      deviceId: input.deviceId,
    });
    return issued.receipt;
  }

  async resendOtp(
    input: {
      phone?: string;
      email?: string;
      purpose: OtpPurpose;
      deviceId?: string;
      captchaToken?: string;
    },
    context: AuthRequestContext,
  ): Promise<OtpChallengeReceipt> {
    await this.captcha.assertHuman({
      token: input.captchaToken,
      action: "otp_resend",
      ip: context.ip,
    });
    this.assertPublicPurpose(input.purpose);
    const destination = resolveDestination(input);
    const policy = await this.configuration.getAuthPolicy();
    await this.rateLimit.assertOtpAllowed(destinationKey(destination), context.ip, policy);

    const challenge = await this.findActiveChallenge(destination, input.purpose);
    if (challenge === null) {
      throw new HasutHttpException("NOT_FOUND", "No active OTP challenge", HttpStatus.NOT_FOUND);
    }
    this.assertChallengeFresh(challenge);
    this.assertCooldown(challenge, policy);

    return this.resendChallenge(challenge.id, destination, policy, context, input.deviceId);
  }

  async verifyOtp(
    input: {
      phone?: string;
      email?: string;
      code: string;
      purpose: OtpPurpose;
      deviceId?: string;
    },
    context: AuthRequestContext,
  ): Promise<AuthVerifyResult> {
    this.assertPublicPurpose(input.purpose);
    const destination = resolveDestination(input);
    const challenge = await this.findActiveChallenge(destination, input.purpose);
    if (challenge === null) {
      throw new HasutHttpException(
        "OTP_INVALID",
        "Invalid verification code",
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.consumeChallenge(challenge.id, input.code, context);

    const member =
      destination.channel === "SMS"
        ? await this.users.upsertByPhone(destination.phoneE164 ?? "")
        : await this.users.upsertByEmail(destination.email ?? "");

    await this.audit.record({
      actorId: member.id,
      action: "AUTH_OTP_VERIFIED",
      entity: "otp_challenge",
      entityId: challenge.id,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { purpose: input.purpose, channel: destination.channel },
    });

    const tokens = await this.issueSession(member, input.deviceId, context);
    return { member, tokens };
  }

  /**
   * Creates, stores, and delivers a code. Shared by the public OTP endpoints and
   * by the credential flows that mint `PASSWORD_RESET` / `TWO_FACTOR` challenges.
   *
   * `deliver: false` still records a challenge and returns a normal receipt but
   * sends nothing. Forgot-password uses it so an unknown address gets the same
   * response without letting anyone mail or text a stranger through us.
   */
  async issueChallenge(input: {
    destination: OtpDestination;
    purpose: OtpPurpose;
    policy: AuthPolicy;
    context: AuthRequestContext;
    deviceId?: string;
    memberId?: string;
    deliver?: boolean;
  }): Promise<{ challengeId: string; receipt: OtpChallengeReceipt }> {
    const { destination, purpose, policy, context } = input;
    const deliver = input.deliver ?? true;
    const now = new Date();
    const code = this.codes.generate(policy.codeLength);
    const expiresAt = new Date(now.getTime() + policy.otpExpirySeconds * 1000);
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        channel: destination.channel,
        phoneE164: destination.phoneE164,
        email: destination.email,
        memberId: input.memberId ?? null,
        codeHash: await this.hasher.hash(code),
        purpose,
        expiresAt,
        maxAttempts: policy.maxAttempts,
        lastSentAt: now,
        ip: context.ip,
        deviceId: input.deviceId ?? null,
      },
    });

    if (deliver) {
      await this.deliver(destination, code, purpose, expiresAt, false);
    }

    await this.audit.record({
      actorId: input.memberId,
      action: "AUTH_OTP_REQUESTED",
      entity: "otp_challenge",
      entityId: challenge.id,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { purpose, channel: destination.channel, delivered: deliver },
    });

    return {
      challengeId: challenge.id,
      receipt: this.toReceipt(challenge, policy, deliver ? code : null),
    };
  }

  /**
   * Checks a code against a stored challenge and burns it. Throws the same
   * `OTP_INVALID` regardless of why, so nothing leaks about the account.
   */
  async consumeChallenge(
    challengeId: string,
    code: string,
    context: AuthRequestContext,
  ): Promise<OtpChallenge> {
    const challenge = await this.prisma.otpChallenge.findUnique({ where: { id: challengeId } });
    if (challenge === null || challenge.consumedAt !== null) {
      throw new HasutHttpException(
        "OTP_INVALID",
        "Invalid verification code",
        HttpStatus.BAD_REQUEST,
      );
    }
    this.assertChallengeFresh(challenge);
    if (challenge.attemptCount >= challenge.maxAttempts) {
      throw new HasutHttpException(
        "OTP_ATTEMPTS_EXCEEDED",
        "Too many verification attempts",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const attempted = await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });

    const valid = await this.matchCode(challenge, code);
    if (!valid) {
      await this.audit.record({
        action: "AUTH_OTP_FAILED",
        entity: "otp_challenge",
        entityId: challenge.id,
        ip: context.ip,
        requestId: context.requestId,
        afterJson: { purpose: challenge.purpose },
      });
      if (attempted.attemptCount >= attempted.maxAttempts) {
        throw new HasutHttpException(
          "OTP_ATTEMPTS_EXCEEDED",
          "Too many verification attempts",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HasutHttpException(
        "OTP_INVALID",
        "Invalid verification code",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

  private async resendChallenge(
    challengeId: string,
    destination: OtpDestination,
    policy: AuthPolicy,
    context: AuthRequestContext,
    deviceId: string | undefined,
  ): Promise<OtpChallengeReceipt> {
    const now = new Date();
    const code = this.codes.generate(policy.codeLength);
    const expiresAt = new Date(now.getTime() + policy.otpExpirySeconds * 1000);
    const updated = await this.prisma.otpChallenge.update({
      where: { id: challengeId },
      data: {
        codeHash: await this.hasher.hash(code),
        expiresAt,
        lastSentAt: now,
        attemptCount: 0,
        ...(deviceId === undefined ? {} : { deviceId }),
      },
    });

    await this.deliver(destination, code, updated.purpose, expiresAt, true);

    await this.audit.record({
      action: "AUTH_OTP_REQUESTED",
      entity: "otp_challenge",
      entityId: updated.id,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { purpose: updated.purpose, channel: destination.channel, resend: true },
    });

    return this.toReceipt(updated, policy, code);
  }

  private async deliver(
    destination: OtpDestination,
    code: string,
    purpose: OtpPurpose,
    expiresAt: Date,
    resend: boolean,
  ): Promise<void> {
    if (destination.channel === "EMAIL") {
      await this.emailProvider.sendOtp({
        email: destination.email ?? "",
        code,
        purpose,
        expiresAt,
      });
      return;
    }
    const payload = { phoneE164: destination.phoneE164 ?? "", code, purpose, expiresAt };
    await (resend ? this.otpProvider.resendOtp(payload) : this.otpProvider.sendOtp(payload));
  }

  /** `PASSWORD_RESET` and `TWO_FACTOR` codes are only minted by their own flows. */
  private assertPublicPurpose(purpose: OtpPurpose): void {
    if (purpose !== "LOGIN" && purpose !== "REAUTH") {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "This verification purpose is not available here",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async refresh(
    input: { refreshToken: string; deviceId?: string },
    context: AuthRequestContext,
  ): Promise<AuthTokens> {
    const parsed = this.parseRefreshToken(input.refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      include: { member: { include: { roles: true } } },
    });
    if (session === null) {
      throw new HasutHttpException(
        "UNAUTHENTICATED",
        "Invalid refresh token",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (session.revokedAt !== null) {
      throw new HasutHttpException(
        "SESSION_REVOKED",
        "Session has been revoked",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new HasutHttpException(
        "UNAUTHENTICATED",
        "Refresh token expired",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const matches = await this.hasher.verify(session.refreshTokenHash, parsed.secret);
    if (!matches) {
      await this.prisma.session.updateMany({
        where: { tokenFamilyId: session.tokenFamilyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorId: session.memberId,
        action: "AUTH_REFRESH_REUSE",
        entity: "session",
        entityId: session.id,
        ip: context.ip,
        requestId: context.requestId,
      });
      throw new HasutHttpException(
        "REFRESH_REUSE",
        "Refresh token reuse detected",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (session.member.status !== "ACTIVE") {
      throw new HasutHttpException(
        "ACCOUNT_SUSPENDED",
        "This account cannot sign in",
        HttpStatus.FORBIDDEN,
      );
    }

    const policy = await this.configuration.getAuthPolicy();
    const now = new Date();
    const nextSecret = this.createRefreshSecret();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await this.hasher.hash(nextSecret),
        expiresAt: new Date(now.getTime() + policy.refreshTtlSeconds * 1000),
        lastSeenAt: now,
        deviceId: input.deviceId ?? session.deviceId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    await this.audit.record({
      actorId: session.memberId,
      action: "AUTH_REFRESH",
      entity: "session",
      entityId: session.id,
      ip: context.ip,
      requestId: context.requestId,
    });

    return {
      accessToken: this.tokens.signAccess(
        {
          sub: session.memberId,
          sid: session.id,
          roles: this.users.toCurrentMember(session.member).roles,
        },
        policy.accessTtlSeconds,
      ),
      refreshToken: this.formatRefreshToken(session.id, nextSecret),
      expiresIn: policy.accessTtlSeconds,
      tokenType: "Bearer",
    };
  }

  async logout(
    actor: RequestAuthContext,
    input: { sessionId?: string },
    context: AuthRequestContext,
  ): Promise<LogoutResult> {
    const sessionId = input.sessionId ?? actor.sessionId;
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (session === null || session.memberId !== actor.memberId) {
      throw new HasutHttpException("NOT_FOUND", "Session not found", HttpStatus.NOT_FOUND);
    }
    if (session.revokedAt === null) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      actorId: actor.memberId,
      action: "AUTH_LOGOUT",
      entity: "session",
      entityId: session.id,
      ip: context.ip,
      requestId: context.requestId,
    });
    return { revoked: true };
  }

  async logoutAll(
    actor: RequestAuthContext,
    context: AuthRequestContext,
  ): Promise<LogoutAllResult> {
    const result = await this.prisma.session.updateMany({
      where: { memberId: actor.memberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actorId: actor.memberId,
      action: "AUTH_LOGOUT_ALL",
      entity: "member",
      entityId: actor.memberId,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { revokedCount: result.count },
    });
    return { revokedCount: result.count };
  }

  async listSessions(actor: RequestAuthContext): Promise<AuthSessionView[]> {
    const sessions = await this.prisma.session.findMany({
      where: { memberId: actor.memberId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
    });
    return sessions.map((session) => ({
      id: session.id,
      deviceId: session.deviceId,
      ip: session.ip,
      userAgent: session.userAgent,
      lastSeenAt: session.lastSeenAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      current: session.id === actor.sessionId,
    }));
  }

  async issueSession(
    member: CurrentMember,
    deviceId: string | undefined,
    context: AuthRequestContext,
  ): Promise<AuthTokens> {
    const policy = await this.configuration.getAuthPolicy();
    const now = new Date();
    const secret = this.createRefreshSecret();
    const session = await this.prisma.session.create({
      data: {
        memberId: member.id,
        deviceId: deviceId ?? null,
        refreshTokenHash: await this.hasher.hash(secret),
        tokenFamilyId: randomUUID(),
        expiresAt: new Date(now.getTime() + policy.refreshTtlSeconds * 1000),
        ip: context.ip,
        userAgent: context.userAgent,
        lastSeenAt: now,
      },
    });

    await this.enforceDeviceCap(member.id, policy);

    await this.audit.record({
      actorId: member.id,
      action: "AUTH_SESSION_ISSUED",
      entity: "session",
      entityId: session.id,
      ip: context.ip,
      requestId: context.requestId,
    });

    return {
      accessToken: this.tokens.signAccess(
        { sub: member.id, sid: session.id, roles: member.roles },
        policy.accessTtlSeconds,
      ),
      refreshToken: this.formatRefreshToken(session.id, secret),
      expiresIn: policy.accessTtlSeconds,
      tokenType: "Bearer",
    };
  }

  private async enforceDeviceCap(memberId: string, policy: AuthPolicy): Promise<void> {
    const active = await this.prisma.session.findMany({
      where: { memberId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "asc" },
    });
    const overflow = active.length - policy.maxDevices;
    if (overflow <= 0) {
      return;
    }
    const revokeIds = active.slice(0, overflow).map((session) => session.id);
    await this.prisma.session.updateMany({
      where: { id: { in: revokeIds } },
      data: { revokedAt: new Date() },
    });
  }

  private async matchCode(challenge: OtpChallenge, code: string): Promise<boolean> {
    // Delegated SMS vendors check the code themselves; email always verifies locally.
    if (this.otpProvider.style === "delegated" && challenge.channel === "SMS") {
      const result = await this.otpProvider.verifyOtp({
        phoneE164: challenge.phoneE164 ?? "",
        code,
        purpose: challenge.purpose,
      });
      return result.valid;
    }
    return this.hasher.verify(challenge.codeHash, code);
  }

  private async findActiveChallenge(
    destination: OtpDestination,
    purpose: OtpPurpose,
  ): Promise<OtpChallenge | null> {
    return this.prisma.otpChallenge.findFirst({
      where: {
        purpose,
        consumedAt: null,
        channel: destination.channel,
        ...(destination.channel === "SMS"
          ? { phoneE164: destination.phoneE164 }
          : { email: destination.email }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private async assertResendAllowed(
    destination: OtpDestination,
    purpose: OtpPurpose,
    policy: AuthPolicy,
  ): Promise<void> {
    const existing = await this.findActiveChallenge(destination, purpose);
    if (existing === null) {
      return;
    }
    if (existing.expiresAt.getTime() <= Date.now()) {
      return;
    }
    this.assertCooldown(existing, policy);
  }

  private assertChallengeFresh(challenge: OtpChallenge): void {
    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new HasutHttpException(
        "OTP_EXPIRED",
        "Verification code expired",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertCooldown(challenge: OtpChallenge, policy: AuthPolicy): void {
    const availableAt = challenge.lastSentAt.getTime() + policy.resendCooldownSeconds * 1000;
    if (Date.now() < availableAt) {
      throw new HasutHttpException(
        "OTP_RESEND_COOLDOWN",
        "Wait before requesting another code",
        HttpStatus.TOO_MANY_REQUESTS,
        { resendAvailableAt: new Date(availableAt).toISOString() },
      );
    }
  }

  private toReceipt(
    challenge: OtpChallenge,
    policy: AuthPolicy,
    code: string | null,
  ): OtpChallengeReceipt {
    const receipt: OtpChallengeReceipt = {
      challengeId: challenge.id,
      channel: challenge.channel,
      destinationHint: destinationHint({
        channel: challenge.channel,
        phoneE164: challenge.phoneE164,
        email: challenge.email,
      }),
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: new Date(
        challenge.lastSentAt.getTime() + policy.resendCooldownSeconds * 1000,
      ).toISOString(),
      codeLength: policy.codeLength,
    };
    if (code !== null && this.shouldExposeDebugCode(challenge.channel)) {
      receipt.debugCode = code;
    }
    return receipt;
  }

  /** Only ever true for the local console adapters outside production. */
  private shouldExposeDebugCode(channel: OtpChannel): boolean {
    const environment = this.config.get("NODE_ENV", { infer: true });
    if (environment !== "development" && environment !== "test") {
      return false;
    }
    const provider =
      channel === "EMAIL"
        ? this.config.get("EMAIL_PROVIDER", { infer: true })
        : this.config.get("OTP_PROVIDER", { infer: true });
    return provider === "console";
  }

  private parseRefreshToken(token: string): { sessionId: string; secret: string } {
    const separator = token.indexOf(REFRESH_SEPARATOR);
    if (separator <= 0 || separator === token.length - 1) {
      throw new HasutHttpException(
        "UNAUTHENTICATED",
        "Invalid refresh token",
        HttpStatus.UNAUTHORIZED,
      );
    }
    return {
      sessionId: token.slice(0, separator),
      secret: token.slice(separator + 1),
    };
  }

  private formatRefreshToken(sessionId: string, secret: string): string {
    return `${sessionId}${REFRESH_SEPARATOR}${secret}`;
  }

  private createRefreshSecret(): string {
    return randomBytes(32).toString("base64url");
  }
}
