import { AUTH_POLICY_DEFAULTS } from "@hasut/config";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import { CredentialsService } from "./credentials.service";
import { CAPTCHA_VERIFIER } from "./providers/captcha-verifier";
import { OAUTH_REGISTRY } from "./providers/oauth-provider";
import { RateLimitService } from "./rate-limit.service";
import { SECRET_HASHER } from "./secret-hasher";

const EMAIL = "jegan@example.com";
const PHONE = "+919876543210";
const PASSWORD = "Chennai-Patron-42";
const CONTEXT = { ip: "127.0.0.1", userAgent: "jest", requestId: "req-cred" };
const TOKENS = {
  accessToken: "access.jwt",
  refreshToken: "session-1.secret",
  expiresIn: 900,
  tokenType: "Bearer" as const,
};

function memberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "member-1",
    phoneE164: PHONE,
    email: EMAIL,
    emailVerifiedAt: new Date(),
    passwordHash: `hash:${PASSWORD}`,
    twoFactorEnabled: false,
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    roles: [{ role: "MEMBER" }],
    ...overrides,
  };
}

describe("CredentialsService", () => {
  const prisma = {
    member: { update: jest.fn() },
    session: { updateMany: jest.fn() },
    otpChallenge: { findUnique: jest.fn() },
  };
  const users = {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    findWithRoles: jest.fn(),
    createWithEmail: jest.fn(),
    upsertBySsoIdentity: jest.fn(),
    setTwoFactor: jest.fn(),
    assertSignInAllowed: jest.fn(),
    toCurrentMember: jest.fn(),
  };
  const auth = {
    issueSession: jest.fn(),
    issueChallenge: jest.fn(),
    consumeChallenge: jest.fn(),
  };
  const configuration = { getAuthPolicy: jest.fn() };
  const audit = { record: jest.fn() };
  const rateLimit = {
    assertOtpAllowed: jest.fn(),
    assertPasswordAttemptAllowed: jest.fn(),
  };
  const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const captcha = { required: false, assertHuman: jest.fn() };
  const googleProvider = { provider: "GOOGLE", configured: true, verify: jest.fn() };
  const oauth = {
    enabled: jest.fn(() => ({ google: true, facebook: false })),
    get: jest.fn(() => googleProvider),
  };
  const hasher = {
    hash: jest.fn(async (plain: string) => `hash:${plain}`),
    verify: jest.fn(async (hashed: string, plain: string) => hashed === `hash:${plain}`),
  };
  const config = {
    get: (key: string) => {
      if (key === "CAPTCHA_PROVIDER") {
        return "none";
      }
      if (key === "RECAPTCHA_SITE_KEY" || key === "FACEBOOK_APP_ID") {
        return "";
      }
      if (key === "GOOGLE_CLIENT_ID") {
        return "google-client-id";
      }
      return undefined;
    },
  };

  async function createService(): Promise<CredentialsService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CredentialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: auth },
        { provide: ConfigurationService, useValue: configuration },
        { provide: AuditService, useValue: audit },
        { provide: RateLimitService, useValue: rateLimit },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: config },
        { provide: CAPTCHA_VERIFIER, useValue: captcha },
        { provide: OAUTH_REGISTRY, useValue: oauth },
        { provide: SECRET_HASHER, useValue: hasher },
      ],
    }).compile();
    return moduleRef.get(CredentialsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    hasher.hash.mockImplementation(async (plain: string) => `hash:${plain}`);
    hasher.verify.mockImplementation(
      async (hashed: string, plain: string) => hashed === `hash:${plain}`,
    );
    configuration.getAuthPolicy.mockResolvedValue(AUTH_POLICY_DEFAULTS);
    captcha.assertHuman.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
    rateLimit.assertPasswordAttemptAllowed.mockResolvedValue(undefined);
    rateLimit.assertOtpAllowed.mockResolvedValue(undefined);
    auth.issueSession.mockResolvedValue(TOKENS);
    oauth.enabled.mockReturnValue({ google: true, facebook: false });
    oauth.get.mockReturnValue(googleProvider);
    prisma.session.updateMany.mockResolvedValue({ count: 2 });
    users.toCurrentMember.mockImplementation((row: ReturnType<typeof memberRow>) => ({
      id: row.id,
      phoneE164: row.phoneE164,
      email: row.email,
      emailVerified: row.emailVerifiedAt !== null,
      hasPassword: row.passwordHash !== null,
      twoFactorEnabled: row.twoFactorEnabled,
      status: row.status,
      roles: ["MEMBER"],
      createdAt: row.createdAt.toISOString(),
    }));
  });

  describe("register", () => {
    it("hashes the password and never stores it in the clear", async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createWithEmail.mockResolvedValue(memberRow({ emailVerifiedAt: null }));

      const service = await createService();
      await service.register({ email: EMAIL, password: PASSWORD, displayName: "Jegan" }, CONTEXT);

      const stored = users.createWithEmail.mock.calls[0][0] as { passwordHash: string };
      expect(stored.passwordHash).toBe(`hash:${PASSWORD}`);
      expect(stored.passwordHash).not.toBe(PASSWORD);
    });

    it("leaves a new email unverified until a code proves inbox control", async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createWithEmail.mockResolvedValue(memberRow({ emailVerifiedAt: null }));

      const service = await createService();
      const result = await service.register(
        { email: EMAIL, password: PASSWORD, displayName: "Jegan" },
        CONTEXT,
      );

      expect(users.createWithEmail).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: false }),
      );
      expect(result.member.emailVerified).toBe(false);
    });

    it("rejects a duplicate email", async () => {
      users.findByEmail.mockResolvedValue(memberRow());

      const service = await createService();
      await expect(
        service.register({ email: EMAIL, password: PASSWORD, displayName: "Jegan" }, CONTEXT),
      ).rejects.toMatchObject({ errorCode: "CONFLICT" });
    });

    it("rejects a password below the configured minimum", async () => {
      configuration.getAuthPolicy.mockResolvedValue({
        ...AUTH_POLICY_DEFAULTS,
        passwordMinLength: 24,
      });

      const service = await createService();
      await expect(
        service.register({ email: EMAIL, password: PASSWORD, displayName: "Jegan" }, CONTEXT),
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
      expect(users.createWithEmail).not.toHaveBeenCalled();
    });
  });

  describe("loginWithPassword", () => {
    it("issues a session when the password matches and 2FA is off", async () => {
      users.findByEmail.mockResolvedValue(memberRow());

      const service = await createService();
      const result = await service.loginWithPassword({ email: EMAIL, password: PASSWORD }, CONTEXT);

      expect(result.status).toBe("AUTHENTICATED");
      expect(auth.issueSession).toHaveBeenCalled();
    });

    it("returns the same error for an unknown email and a wrong password", async () => {
      const service = await createService();

      async function attempt(password: string): Promise<{ errorCode: string; message: string }> {
        try {
          await service.loginWithPassword({ email: EMAIL, password }, CONTEXT);
          throw new Error("expected sign in to fail");
        } catch (error) {
          const failed = error as { errorCode?: string; message: string };
          return { errorCode: failed.errorCode ?? "", message: failed.message };
        }
      }

      users.findByEmail.mockResolvedValue(null);
      const unknown = await attempt(PASSWORD);

      users.findByEmail.mockResolvedValue(memberRow());
      const wrong = await attempt("Wrong-Password-99");

      expect(unknown.errorCode).toBe("UNAUTHENTICATED");
      expect(wrong.errorCode).toBe("UNAUTHENTICATED");
      expect(unknown.message).toBe(wrong.message);
    });

    it("withholds tokens and starts a phone challenge when 2FA is enabled", async () => {
      users.findByEmail.mockResolvedValue(memberRow({ twoFactorEnabled: true }));
      auth.issueChallenge.mockResolvedValue({
        challengeId: "challenge-1",
        receipt: {
          challengeId: "challenge-1",
          channel: "SMS",
          destinationHint: "•••••• 3210",
          expiresAt: new Date().toISOString(),
          resendAvailableAt: new Date().toISOString(),
          codeLength: 6,
        },
      });

      const service = await createService();
      const result = await service.loginWithPassword({ email: EMAIL, password: PASSWORD }, CONTEXT);

      expect(result.status).toBe("TWO_FACTOR_REQUIRED");
      expect(result).not.toHaveProperty("tokens");
      expect(auth.issueSession).not.toHaveBeenCalled();
      expect(auth.issueChallenge).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: "TWO_FACTOR",
          destination: { channel: "SMS", phoneE164: PHONE, email: null },
        }),
      );
    });

    it("falls back to email for the second factor when there is no phone", async () => {
      users.findByEmail.mockResolvedValue(memberRow({ twoFactorEnabled: true, phoneE164: null }));
      auth.issueChallenge.mockResolvedValue({
        challengeId: "challenge-1",
        receipt: { channel: "EMAIL" },
      });

      const service = await createService();
      await service.loginWithPassword({ email: EMAIL, password: PASSWORD }, CONTEXT);

      expect(auth.issueChallenge).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: { channel: "EMAIL", phoneE164: null, email: EMAIL },
        }),
      );
    });

    it("refuses a suspended account even with the right password", async () => {
      users.findByEmail.mockResolvedValue(memberRow({ status: "SUSPENDED" }));
      users.assertSignInAllowed.mockImplementation(() => {
        throw Object.assign(new Error("suspended"), { errorCode: "ACCOUNT_SUSPENDED" });
      });

      const service = await createService();
      await expect(
        service.loginWithPassword({ email: EMAIL, password: PASSWORD }, CONTEXT),
      ).rejects.toMatchObject({ errorCode: "ACCOUNT_SUSPENDED" });
      expect(auth.issueSession).not.toHaveBeenCalled();
    });
  });

  describe("verifyTwoFactor", () => {
    it("issues a session only after the second code is consumed", async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue({
        id: "challenge-1",
        purpose: "TWO_FACTOR",
        memberId: "member-1",
      });
      auth.consumeChallenge.mockResolvedValue({ memberId: "member-1" });
      users.findWithRoles.mockResolvedValue(memberRow({ twoFactorEnabled: true }));

      const service = await createService();
      const result = await service.verifyTwoFactor(
        { challengeId: "challenge-1", code: "123456" },
        CONTEXT,
      );

      expect(auth.consumeChallenge).toHaveBeenCalled();
      expect(result.tokens).toEqual(TOKENS);
    });

    it("rejects a challenge minted for a different purpose", async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue({
        id: "challenge-1",
        purpose: "LOGIN",
        memberId: "member-1",
      });

      const service = await createService();
      await expect(
        service.verifyTwoFactor({ challengeId: "challenge-1", code: "123456" }, CONTEXT),
      ).rejects.toMatchObject({ errorCode: "OTP_INVALID" });
      expect(auth.consumeChallenge).not.toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("returns a receipt for an unknown address so accounts cannot be enumerated", async () => {
      users.findByEmail.mockResolvedValue(null);
      auth.issueChallenge.mockResolvedValue({
        challengeId: "challenge-9",
        receipt: { challengeId: "challenge-9", channel: "EMAIL" },
      });

      const service = await createService();
      const receipt = await service.forgotPassword({ email: EMAIL }, CONTEXT);

      expect(receipt.challengeId).toBe("challenge-9");
      expect(auth.issueChallenge).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: "PASSWORD_RESET", memberId: undefined }),
      );
    });

    it("sends nothing to an address that has no account", async () => {
      users.findByEmail.mockResolvedValue(null);
      auth.issueChallenge.mockResolvedValue({
        challengeId: "challenge-9",
        receipt: { challengeId: "challenge-9", channel: "EMAIL" },
      });

      const service = await createService();
      await service.forgotPassword({ email: EMAIL }, CONTEXT);

      expect(auth.issueChallenge).toHaveBeenCalledWith(expect.objectContaining({ deliver: false }));
    });

    it("delivers the code when the account exists", async () => {
      users.findByEmail.mockResolvedValue(memberRow());
      auth.issueChallenge.mockResolvedValue({
        challengeId: "challenge-9",
        receipt: { challengeId: "challenge-9", channel: "EMAIL" },
      });

      const service = await createService();
      await service.forgotPassword({ email: EMAIL }, CONTEXT);

      expect(auth.issueChallenge).toHaveBeenCalledWith(
        expect.objectContaining({ deliver: true, memberId: "member-1" }),
      );
    });
  });

  describe("resetPassword", () => {
    it("burns the ticket and revokes every existing session", async () => {
      redis.get.mockResolvedValue("member-1");

      const service = await createService();
      const result = await service.resetPassword(
        { ticket: "ticket-1", password: PASSWORD },
        CONTEXT,
      );

      expect(redis.del).toHaveBeenCalledWith("auth:reset:ticket-1");
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { memberId: "member-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual({ updated: true, revokedSessionCount: 2 });
    });

    it("rejects a replayed or expired ticket", async () => {
      redis.get.mockResolvedValue(null);

      const service = await createService();
      await expect(
        service.resetPassword({ ticket: "ticket-1", password: PASSWORD }, CONTEXT),
      ).rejects.toMatchObject({ errorCode: "UNAUTHENTICATED" });
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it("rejects a ticket that resolved to no account", async () => {
      redis.get.mockResolvedValue("");

      const service = await createService();
      await expect(
        service.resetPassword({ ticket: "ticket-1", password: PASSWORD }, CONTEXT),
      ).rejects.toMatchObject({ errorCode: "UNAUTHENTICATED" });
      expect(redis.del).toHaveBeenCalledWith("auth:reset:ticket-1");
    });
  });

  describe("loginWithSso", () => {
    it("signs in through a verified provider identity", async () => {
      googleProvider.verify.mockResolvedValue({
        provider: "GOOGLE",
        providerAccountId: "google-sub-1",
        email: EMAIL,
        emailVerified: true,
        displayName: "Jegan",
      });
      users.upsertBySsoIdentity.mockResolvedValue(memberRow());

      const service = await createService();
      const result = await service.loginWithSso({ provider: "GOOGLE", token: "id-token" }, CONTEXT);

      expect(result.tokens).toEqual(TOKENS);
      expect(users.upsertBySsoIdentity).toHaveBeenCalledWith(
        expect.objectContaining({ providerAccountId: "google-sub-1", emailVerified: true }),
      );
    });
  });

  describe("setTwoFactor", () => {
    it("refuses to enable a second step with no delivery channel", async () => {
      users.findWithRoles.mockResolvedValue(memberRow({ phoneE164: null, email: null }));

      const service = await createService();
      await expect(service.setTwoFactor("member-1", true, CONTEXT)).rejects.toMatchObject({
        errorCode: "VALIDATION_ERROR",
      });
      expect(users.setTwoFactor).not.toHaveBeenCalled();
    });
  });

  describe("clientConfig", () => {
    it("publishes the site key and enabled providers, never the secret", async () => {
      const service = await createService();
      const result = await service.clientConfig();

      expect(result).toEqual({
        captcha: { provider: "none", required: false, siteKey: "" },
        sso: {
          google: { enabled: true, clientId: "google-client-id" },
          facebook: { enabled: false, appId: "" },
        },
        passwordMinLength: AUTH_POLICY_DEFAULTS.passwordMinLength,
        codeLength: AUTH_POLICY_DEFAULTS.codeLength,
        resendCooldownSeconds: AUTH_POLICY_DEFAULTS.resendCooldownSeconds,
      });
    });
  });
});
