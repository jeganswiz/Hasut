import { randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../config/env";

@Injectable()
export class OtpCodeGenerator {
  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  generate(length: number): string {
    const environment = this.config.get("NODE_ENV", { infer: true });
    const provider = this.config.get("OTP_PROVIDER", { infer: true });
    const fixed = this.config.get("DEV_OTP_CODE", { infer: true });
    if (environment !== "production" && provider === "console" && /^\d{4,8}$/.test(fixed)) {
      return fixed.padStart(length, "0").slice(-length);
    }
    const digits: string[] = [];
    for (let index = 0; index < length; index += 1) {
      digits.push(String(randomInt(0, 10)));
    }
    return digits.join("");
  }
}
