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
import { CAPTCHA_VERIFIER } from "./providers/captcha-verifier";
import { EMAIL_PROVIDER } from "./providers/email-provider";
import { OTP_PROVIDER } from "./providers/otp-provider";
import { RateLimitService } from "./rate-limit.service";
import { SECRET_HASHER } from "./secret-hasher";
import { TokenService } from "./token.service";

const PHONE = "+919876543210";
const EMAIL = "jegan@example.com";
const CONTEXT = { ip: "127.0.0.1", userAgent: "jest", requestId: "req-auth" };
const MEMBER = {
  id: "member-1",
  phoneE164: PHONE,
  email: null,
  emailVerified: false,
  hasPassword: false,
  twoFactorEnabled: false,
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
      findUnique: jest.fn(),
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
    upsertByEmail: jest.fn(),
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
  const emailProvider = {
    sendOtp: jest.fn(),
  };
  const captcha = {
    required: false,
    assertHuman: jest.fn(),
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
      if (key === "OTP_PROVIDER" || key === "EMAIL_PROVIDER") {
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
        { provide: EMAIL_PROVIDER, useValue: emailProvider },
        { provide: CAPTCHA_VERIFIER, useValue: captcha },
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
    emailProvider.sendOtp.mockResolvedValue({});
    captcha.assertHuman.mockResolvedValue(undefined);
    codes.generate.mockReturnValue("123456");
    tokens.signAccess.mockReturnValue("access.jwt");
    users.upsertByPhone.mockResolvedValue(MEMBER);
    users.upsertByEmail.mockResolvedValue({ ...MEMBER, email: EMAIL, emailVerified: true });
    users.toCurrentMember.mockReturnValue(MEMBER);
    prisma.session.findMany.mockResolvedValue([]);
    prisma.session.updateMany.mockResolvedValue({ count: 0 });
  });

  function challengeRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "challenge-1",
      channel: "SMS",
      phoneE164: PHONE,
      email: null,
      memberId: null,
      codeHash: "hash:123456",
      purpose: "LOGIN",
      expiresAt: futureDate(),
      attemptCount: 0,
      maxAttempts: 5,
      lastSentAt: new Date(),
      consumedAt: null,
      ...overrides,
    };
  }

  /** `verifyOtp` locates the challenge, then `consumeChallenge` reloads it by id. */
  function stageChallenge(row: ReturnType<typeof challengeRow>): void {
    prisma.otpChallenge.findFirst.mockResolvedValue(row);
    prisma.otpChallenge.findUnique.mockResolvedValue(row);
    prisma.otpChallenge.update.mockResolvedValue({ ...row, attemptCount: row.attemptCount + 1 });
  }

  it("accepts a valid OTP and issues tokens", async () => {
    stageChallenge(challengeRow());
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

  it("signs in through an email code and upserts by email", async () => {
    stageChallenge(challengeRow({ channel: "EMAIL", phoneE164: null, email: EMAIL }));
    prisma.session.create.mockResolvedValue({ id: "session-2", memberId: MEMBER.id });

    const service = await createService();
    const result = await service.verifyOtp(
      { email: EMAIL, code: "123456", purpose: "LOGIN" },
      CONTEXT,
    );

    expect(users.upsertByEmail).toHaveBeenCalledWith(EMAIL);
    expect(users.upsertByPhone).not.toHaveBeenCalled();
    expect(result.tokens.accessToken).toBe("access.jwt");
  });

  it("sends an email code through the email provider, not the SMS provider", async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue(null);
    prisma.otpChallenge.create.mockResolvedValue(
      challengeRow({ channel: "EMAIL", phoneE164: null, email: EMAIL }),
    );

    const service = await createService();
    const receipt = await service.requestOtp({ email: EMAIL, purpose: "LOGIN" }, CONTEXT);

    expect(emailProvider.sendOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL, code: "123456" }),
    );
    expect(otpProvider.sendOtp).not.toHaveBeenCalled();
    expect(receipt.channel).toBe("EMAIL");
    expect(receipt.destinationHint).toBe("je•••@example.com");
  });

  it("never returns a full destination on the receipt", async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue(null);
    prisma.otpChallenge.create.mockResolvedValue(challengeRow());

    const service = await createService();
    const receipt = await service.requestOtp({ phone: PHONE, purpose: "LOGIN" }, CONTEXT);

    expect(receipt.destinationHint).toBe("•••••• 3210");
    expect(JSON.stringify(receipt)).not.toContain(PHONE);
  });

  it("refuses to mint a reset or two-factor code from the public endpoint", async () => {
    const service = await createService();
    await expect(
      service.requestOtp({ phone: PHONE, purpose: "PASSWORD_RESET" }, CONTEXT),
    ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
    await expect(
      service.requestOtp({ phone: PHONE, purpose: "TWO_FACTOR" }, CONTEXT),
    ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
    expect(prisma.otpChallenge.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid OTP", async () => {
    stageChallenge(challengeRow());

    const service = await createService();
    await expect(
      service.verifyOtp({ phone: PHONE, code: "000000", purpose: "LOGIN" }, CONTEXT),
    ).rejects.toMatchObject({ errorCode: "OTP_INVALID" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "AUTH_OTP_FAILED" }),
    );
  });

  it("rejects an expired OTP", async () => {
    stageChallenge(challengeRow({ expiresAt: pastDate(), lastSentAt: pastDate() }));

    const service = await createService();
    await expect(
      service.verifyOtp({ phone: PHONE, code: "123456", purpose: "LOGIN" }, CONTEXT),
    ).rejects.toMatchObject({ errorCode: "OTP_EXPIRED" });
    expect(prisma.otpChallenge.update).not.toHaveBeenCalled();
  });

  it("rejects too many verification attempts", async () => {
    stageChallenge(challengeRow({ attemptCount: 5 }));

    const service = await createService();
    await expect(
      service.verifyOtp({ phone: PHONE, code: "123456", purpose: "LOGIN" }, CONTEXT),
    ).rejects.toMatchObject({ errorCode: "OTP_ATTEMPTS_EXCEEDED" });
  });

  it("enforces resend cooldown", async () => {
    stageChallenge(challengeRow());

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
        email: null,
        emailVerifiedAt: null,
        passwordHash: null,
        twoFactorEnabled: false,
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
      new HasutHttpException("RATE_LIMITED", "Too many verification codes requested", 429),
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
