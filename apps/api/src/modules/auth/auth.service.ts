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
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
  ) {}

  async requestOtp(
    input: { phone: string; purpose: OtpPurpose; deviceId?: string },
    context: AuthRequestContext,
  ): Promise<OtpChallengeReceipt> {
    const policy = await this.configuration.getAuthPolicy();
    await this.rateLimit.assertOtpAllowed(input.phone, context.ip, policy);
    await this.assertResendAllowed(input.phone, input.purpose, policy);

    const now = new Date();
    const code = this.codes.generate(policy.codeLength);
    const expiresAt = new Date(now.getTime() + policy.otpExpirySeconds * 1000);
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        phoneE164: input.phone,
        codeHash: await this.hasher.hash(code),
        purpose: input.purpose,
        expiresAt,
        maxAttempts: policy.maxAttempts,
        lastSentAt: now,
        ip: context.ip,
        deviceId: input.deviceId ?? null,
      },
    });

    await this.otpProvider.sendOtp({
      phoneE164: input.phone,
      code,
      purpose: input.purpose,
      expiresAt,
    });

    await this.audit.record({
      action: "AUTH_OTP_REQUESTED",
      entity: "otp_challenge",
      entityId: challenge.id,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { purpose: input.purpose },
    });

    return this.toReceipt(challenge, policy, code);
  }

  async resendOtp(
    input: { phone: string; purpose: OtpPurpose; deviceId?: string },
    context: AuthRequestContext,
  ): Promise<OtpChallengeReceipt> {
    const policy = await this.configuration.getAuthPolicy();
    await this.rateLimit.assertOtpAllowed(input.phone, context.ip, policy);

    const challenge = await this.findActiveChallenge(input.phone, input.purpose);
    if (challenge === null) {
      throw new HasutHttpException("NOT_FOUND", "No active OTP challenge", HttpStatus.NOT_FOUND);
    }
    this.assertChallengeFresh(challenge);
    this.assertCooldown(challenge, policy);

    const now = new Date();
    const code = this.codes.generate(policy.codeLength);
    const expiresAt = new Date(now.getTime() + policy.otpExpirySeconds * 1000);
    const updated = await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        codeHash: await this.hasher.hash(code),
        expiresAt,
        lastSentAt: now,
        attemptCount: 0,
        deviceId: input.deviceId ?? challenge.deviceId,
      },
    });

    await this.otpProvider.resendOtp({
      phoneE164: input.phone,
      code,
      purpose: input.purpose,
      expiresAt,
    });

    await this.audit.record({
      action: "AUTH_OTP_REQUESTED",
      entity: "otp_challenge",
      entityId: updated.id,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { purpose: input.purpose, resend: true },
    });

    return this.toReceipt(updated, policy, code);
  }

  async verifyOtp(
    input: { phone: string; code: string; purpose: OtpPurpose; deviceId?: string },
    context: AuthRequestContext,
  ): Promise<AuthVerifyResult> {
    const challenge = await this.findActiveChallenge(input.phone, input.purpose);
    if (challenge === null) {
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

    const valid = await this.matchCode(challenge, input);
    if (!valid) {
      await this.audit.record({
        action: "AUTH_OTP_FAILED",
        entity: "otp_challenge",
        entityId: challenge.id,
        ip: context.ip,
        requestId: context.requestId,
        afterJson: { purpose: input.purpose },
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

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const member = await this.users.upsertByPhone(input.phone);
    await this.audit.record({
      actorId: member.id,
      action: "AUTH_OTP_VERIFIED",
      entity: "otp_challenge",
      entityId: challenge.id,
      ip: context.ip,
      requestId: context.requestId,
      afterJson: { purpose: input.purpose },
    });

    const tokens = await this.issueSession(member, input.deviceId, context);
    return { member, tokens };
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

  private async issueSession(
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

  private async matchCode(
    challenge: OtpChallenge,
    input: { phone: string; code: string; purpose: OtpPurpose },
  ): Promise<boolean> {
    if (this.otpProvider.style === "delegated") {
      const result = await this.otpProvider.verifyOtp({
        phoneE164: input.phone,
        code: input.code,
        purpose: input.purpose,
      });
      return result.valid;
    }
    return this.hasher.verify(challenge.codeHash, input.code);
  }

  private async findActiveChallenge(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<OtpChallenge | null> {
    return this.prisma.otpChallenge.findFirst({
      where: { phoneE164: phone, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  private async assertResendAllowed(
    phone: string,
    purpose: OtpPurpose,
    policy: AuthPolicy,
  ): Promise<void> {
    const existing = await this.findActiveChallenge(phone, purpose);
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
    code: string,
  ): OtpChallengeReceipt {
    const receipt: OtpChallengeReceipt = {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: new Date(
        challenge.lastSentAt.getTime() + policy.resendCooldownSeconds * 1000,
      ).toISOString(),
    };
    if (this.shouldExposeDebugCode()) {
      receipt.debugCode = code;
    }
    return receipt;
  }

  private shouldExposeDebugCode(): boolean {
    const environment = this.config.get("NODE_ENV", { infer: true });
    const provider = this.config.get("OTP_PROVIDER", { infer: true });
    return provider === "console" && (environment === "development" || environment === "test");
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
