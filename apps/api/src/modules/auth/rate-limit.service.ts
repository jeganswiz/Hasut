import type { AuthPolicy } from "@hasut/config";
import { HttpStatus, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { RedisService } from "../redis/redis.service";

const HOUR_SECONDS = 3600;

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  /**
   * `destinationKey` is already channel-scoped, so SMS floods cannot lock a
   * member out of email codes.
   */
  async assertOtpAllowed(
    destinationKey: string,
    ip: string | null,
    policy: AuthPolicy,
  ): Promise<void> {
    const count = await this.redis.incrementWithTtl(`rl:otp:${destinationKey}`, HOUR_SECONDS);
    if (count > policy.maxChallengesPerPhonePerHour) {
      throw new HasutHttpException(
        "RATE_LIMITED",
        "Too many verification codes requested",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.assertIpAllowed("otp", ip, policy.maxChallengesPerIpPerHour);
  }

  /** Throttles credential stuffing per account and per network. */
  async assertPasswordAttemptAllowed(
    email: string,
    ip: string | null,
    policy: AuthPolicy,
  ): Promise<void> {
    const count = await this.redis.incrementWithTtl(`rl:pwd:email:${email}`, HOUR_SECONDS);
    if (count > policy.maxPasswordAttemptsPerHour) {
      throw new HasutHttpException(
        "RATE_LIMITED",
        "Too many sign-in attempts. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.assertIpAllowed("pwd", ip, policy.maxChallengesPerIpPerHour);
  }

  private async assertIpAllowed(bucket: string, ip: string | null, limit: number): Promise<void> {
    if (ip === null || ip.length === 0) {
      return;
    }
    const count = await this.redis.incrementWithTtl(`rl:${bucket}:ip:${ip}`, HOUR_SECONDS);
    if (count > limit) {
      throw new HasutHttpException(
        "RATE_LIMITED",
        "Too many requests from this network",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
