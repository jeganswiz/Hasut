import { AUTH_POLICY_DEFAULTS } from "@hasut/config";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import { OtpCodeGenerator } from "./otp-code.generator";
import { OTP_PROVIDER } from "./providers/otp-provider";
import { RateLimitService } from "./rate-limit.service";
import { SECRET_HASHER } from "./secret-hasher";
import { TokenService } from "./token.service";

const PHONE = "+919876543210";
const CONTEXT = { ip: "127.0.0.1", userAgent: "jest", requestId: "req-auth" };
const MEMBER = {
  id: "member-1",
  phoneE164: PHONE,
  status: "ACTIVE" as const,
  roles: ["MEMBER" as const],
  createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
};

function futureDate(): Date {
  return new Date(Date.now() + 5 * 60 * 1000);
}

function pastDate(): Date {
  return new Date(Date.now() - 5 * 60 * 1000);
}

describe("AuthService", () => {
  const prisma = {
    otpChallenge: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const users = {
    upsertByPhone: jest.fn(),
    toCurrentMember: jest.fn(),
  };
  const configuration = {
    getAuthPolicy: jest.fn(),
  };
  const audit = {
    record: jest.fn(),
  };
  const rateLimit = {
    assertOtpAllowed: jest.fn(),
  };
  const tokens = {
    signAccess: jest.fn(),
  };
  const codes = {
    generate: jest.fn(),
  };
  const otpProvider = {
    style: "transport" as const,
    sendOtp: jest.fn(),
    verifyOtp: jest.fn(),
    resendOtp: jest.fn(),
  };
  const hasher = {
    hash: jest.fn(async (plain: string) => `hash:${plain}`),
    verify: jest.fn(async (hashed: string, plain: string) => hashed === `hash:${plain}`),
  };
  const config = {
    get: (key: string) => {
      if (key === "NODE_ENV") {
        return "test";
      }
      if (key === "OTP_PROVIDER") {
        return "console";
      }
      return undefined;
    },
  };

  async function createService(): Promise<AuthService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: ConfigurationService, useValue: configuration },
        { provide: AuditService, useValue: audit },
        { provide: RateLimitService, useValue: rateLimit },
        { provide: TokenService, useValue: tokens },
        { provide: OtpCodeGenerator, useValue: codes },
        { provide: ConfigService, useValue: config },
        { provide: OTP_PROVIDER, useValue: otpProvider },
        { provide: SECRET_HASHER, useValue: hasher },
      ],
    }).compile();
    return moduleRef.get(AuthService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    hasher.hash.mockImplementation(async (plain: string) => `hash:${plain}`);
    hasher.verify.mockImplementation(
      async (hashed: string, plain: string) => hashed === `hash:${plain}`,
    );
    configuration.getAuthPolicy.mockResolvedValue(AUTH_POLICY_DEFAULTS);
    rateLimit.assertOtpAllowed.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
    otpProvider.sendOtp.mockResolvedValue({});
    otpProvider.resendOtp.mockResolvedValue({});
    otpProvider.style = "transport";
    codes.generate.mockReturnValue("123456");
    tokens.signAccess.mockReturnValue("access.jwt");
    users.upsertByPhone.mockResolvedValue(MEMBER);
    users.toCurrentMember.mockReturnValue(MEMBER);
    prisma.session.findMany.mockResolvedValue([]);
    prisma.session.updateMany.mockResolvedValue({ count: 0 });
  });

  it("accepts a valid OTP and issues tokens", async () => {
    const challenge = {
      id: "challenge-1",
      phoneE164: PHONE,
      codeHash: "hash:123456",
      purpose: "LOGIN",
      expiresAt: futureDate(),
      attemptCount: 0,
      maxAttempts: 5,
      lastSentAt: new Date(),
      consumedAt: null,
    };
    prisma.otpChallenge.findFirst.mockResolvedValue(challenge);
    prisma.otpChallenge.update.mockResolvedValue({ ...challenge, attemptCount: 1 });
    prisma.session.create.mockResolvedValue({
      id: "session-1",
      memberId: MEMBER.id,
    });

    const service = await createService();
    const result = await service.verifyOtp(
      { phone: PHONE, code: "123456", purpose: "LOGIN" },
      CONTEXT,
    );

    expect(result.member.id).toBe(MEMBER.id);
    expect(result.tokens.accessToken).toBe("access.jwt");
    expect(result.tokens.refreshToken.startsWith("session-1.")).toBe(true);
    expect(otpProvider.sendOtp).not.toHaveBeenCalled();
  });

  it("rejects an invalid OTP", async () => {
    const challenge = {
      id: "challenge-1",
      phoneE164: PHONE,
      codeHash: "hash:123456",
      purpose: "LOGIN",
      expiresAt: futureDate(),
      attemptCount: 0,
      maxAttempts: 5,
      lastSentAt: new Date(),
      consumedAt: null,
    };
    prisma.otpChallenge.findFirst.mockResolvedValue(challenge);
    prisma.otpChallenge.update.mockResolvedValue({ ...challenge, attemptCount: 1 });

    const service = await createService();
    await expect(
      service.verifyOtp({ phone: PHONE, code: "000000", purpose: "LOGIN" }, CONTEXT),
    ).rejects.toMatchObject({ errorCode: "OTP_INVALID" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "AUTH_OTP_FAILED" }),
    );
  });

  it("rejects an expired OTP", async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue({
      id: "challenge-1",
      phoneE164: PHONE,
      codeHash: "hash:123456",
      purpose: "LOGIN",
      expiresAt: pastDate(),
      attemptCount: 0,
      maxAttempts: 5,
      lastSentAt: pastDate(),
      consumedAt: null,
    });

    const service = await createService();
    await expect(
      service.verifyOtp({ phone: PHONE, code: "123456", purpose: "LOGIN" }, CONTEXT),
    ).rejects.toMatchObject({ errorCode: "OTP_EXPIRED" });
    expect(prisma.otpChallenge.update).not.toHaveBeenCalled();
  });

  it("rejects too many verification attempts", async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue({
      id: "challenge-1",
      phoneE164: PHONE,
      codeHash: "hash:123456",
      purpose: "LOGIN",
      expiresAt: futureDate(),
      attemptCount: 5,
      maxAttempts: 5,
      lastSentAt: new Date(),
      consumedAt: null,
    });

    const service = await createService();
    await expect(
      service.verifyOtp({ phone: PHONE, code: "123456", purpose: "LOGIN" }, CONTEXT),
    ).rejects.toMatchObject({ errorCode: "OTP_ATTEMPTS_EXCEEDED" });
  });

  it("enforces resend cooldown", async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue({
      id: "challenge-1",
      phoneE164: PHONE,
      codeHash: "hash:123456",
      purpose: "LOGIN",
      expiresAt: futureDate(),
      attemptCount: 0,
      maxAttempts: 5,
      lastSentAt: new Date(),
      consumedAt: null,
    });

    const service = await createService();
    await expect(
      service.resendOtp({ phone: PHONE, purpose: "LOGIN" }, CONTEXT),
    ).rejects.toMatchObject({
      errorCode: "OTP_RESEND_COOLDOWN",
    });
    expect(otpProvider.resendOtp).not.toHaveBeenCalled();
  });

  it("revokes the current session on logout", async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: "session-1",
      memberId: MEMBER.id,
      revokedAt: null,
    });
    prisma.session.update.mockResolvedValue({ id: "session-1" });

    const service = await createService();
    const result = await service.logout(
      { memberId: MEMBER.id, sessionId: "session-1", roles: ["MEMBER"] },
      {},
      CONTEXT,
    );

    expect(result.revoked).toBe(true);
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "AUTH_LOGOUT" }));
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const session = {
      id: "11111111-1111-1111-1111-111111111111",
      memberId: MEMBER.id,
      refreshTokenHash: "hash:first-secret",
      tokenFamilyId: "family-1",
      revokedAt: null,
      expiresAt: futureDate(),
      deviceId: null,
      member: {
        id: MEMBER.id,
        phoneE164: PHONE,
        status: "ACTIVE",
        createdAt: new Date(MEMBER.createdAt),
        roles: [{ role: "MEMBER" }],
      },
    };
    prisma.session.findUnique.mockResolvedValue(session);
    prisma.session.update.mockImplementation(
      async ({ data }: { data: { refreshTokenHash: string } }) => {
        session.refreshTokenHash = data.refreshTokenHash;
        return session;
      },
    );

    const service = await createService();
    const first = await service.refresh({ refreshToken: `${session.id}.first-secret` }, CONTEXT);
    expect(first.accessToken).toBe("access.jwt");
    expect(first.refreshToken.startsWith(`${session.id}.`)).toBe(true);
    expect(first.refreshToken).not.toBe(`${session.id}.first-secret`);

    await expect(
      service.refresh({ refreshToken: `${session.id}.first-secret` }, CONTEXT),
    ).rejects.toMatchObject({ errorCode: "REFRESH_REUSE" });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { tokenFamilyId: "family-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "AUTH_REFRESH_REUSE" }),
    );
  });

  it("surfaces rate-limit failures from the rate limiter", async () => {
    rateLimit.assertOtpAllowed.mockRejectedValue(
      new HasutHttpException("RATE_LIMITED", "Too many OTP requests for this phone", 429),
    );
    prisma.otpChallenge.findFirst.mockResolvedValue(null);

    const service = await createService();
    await expect(
      service.requestOtp({ phone: PHONE, purpose: "LOGIN" }, CONTEXT),
    ).rejects.toMatchObject({
      errorCode: "RATE_LIMITED",
    });
  });
});
