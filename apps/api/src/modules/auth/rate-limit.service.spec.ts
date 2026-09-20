import { AUTH_POLICY_DEFAULTS } from "@hasut/config";
import { RateLimitService } from "./rate-limit.service";
import { RedisService } from "../redis/redis.service";

describe("RateLimitService", () => {
  const redis = {
    incrementWithTtl: jest.fn(),
  };

  function createService(): RateLimitService {
    return new RateLimitService(redis as unknown as RedisService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("allows requests under the configured destination and IP caps", async () => {
    redis.incrementWithTtl.mockResolvedValue(1);
    const service = createService();
    await expect(
      service.assertOtpAllowed("phone:+919876543210", "127.0.0.1", AUTH_POLICY_DEFAULTS),
    ).resolves.toBeUndefined();
  });

  it("rejects a destination that exceeds the hourly challenge cap", async () => {
    redis.incrementWithTtl.mockResolvedValue(AUTH_POLICY_DEFAULTS.maxChallengesPerPhonePerHour + 1);
    const service = createService();
    await expect(
      service.assertOtpAllowed("phone:+919876543210", "127.0.0.1", AUTH_POLICY_DEFAULTS),
    ).rejects.toMatchObject({ errorCode: "RATE_LIMITED" });
  });

  it("counts SMS and email buckets independently", async () => {
    redis.incrementWithTtl.mockResolvedValue(1);
    const service = createService();
    await service.assertOtpAllowed("phone:+919876543210", null, AUTH_POLICY_DEFAULTS);
    await service.assertOtpAllowed("email:jegan@example.com", null, AUTH_POLICY_DEFAULTS);
    const keys = redis.incrementWithTtl.mock.calls.map((call) => call[0]);
    expect(new Set(keys).size).toBe(2);
  });

  it("locks out password attempts past the configured cap", async () => {
    redis.incrementWithTtl.mockResolvedValue(AUTH_POLICY_DEFAULTS.maxPasswordAttemptsPerHour + 1);
    const service = createService();
    await expect(
      service.assertPasswordAttemptAllowed("jegan@example.com", "127.0.0.1", AUTH_POLICY_DEFAULTS),
    ).rejects.toMatchObject({ errorCode: "RATE_LIMITED" });
  });
});
