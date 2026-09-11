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

  it("allows requests under the configured phone and IP caps", async () => {
    redis.incrementWithTtl.mockResolvedValue(1);
    const service = createService();
    await expect(
      service.assertOtpAllowed("+919876543210", "127.0.0.1", AUTH_POLICY_DEFAULTS),
    ).resolves.toBeUndefined();
  });

  it("rejects a phone that exceeds the hourly challenge cap", async () => {
    redis.incrementWithTtl.mockResolvedValue(AUTH_POLICY_DEFAULTS.maxChallengesPerPhonePerHour + 1);
    const service = createService();
    await expect(
      service.assertOtpAllowed("+919876543210", "127.0.0.1", AUTH_POLICY_DEFAULTS),
    ).rejects.toMatchObject({ errorCode: "RATE_LIMITED" });
  });
});
