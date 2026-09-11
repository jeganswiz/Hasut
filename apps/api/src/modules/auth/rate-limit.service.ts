import type { AuthPolicy } from "@hasut/config";
import { HttpStatus, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { RedisService } from "../redis/redis.service";

const HOUR_SECONDS = 3600;

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async assertOtpAllowed(phoneE164: string, ip: string | null, policy: AuthPolicy): Promise<void> {
    const phoneCount = await this.redis.incrementWithTtl(`rl:otp:phone:${phoneE164}`, HOUR_SECONDS);
    if (phoneCount > policy.maxChallengesPerPhonePerHour) {
      throw new HasutHttpException(
        "RATE_LIMITED",
        "Too many OTP requests for this phone",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (ip === null || ip.length === 0) {
      return;
    }

    const ipCount = await this.redis.incrementWithTtl(`rl:otp:ip:${ip}`, HOUR_SECONDS);
    if (ipCount > policy.maxChallengesPerIpPerHour) {
      throw new HasutHttpException(
        "RATE_LIMITED",
        "Too many OTP requests from this network",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
