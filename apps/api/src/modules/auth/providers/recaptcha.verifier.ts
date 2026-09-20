import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../../common/errors/hasut-http.exception";
import type { ApiEnv } from "../../../config/env";
import type { CaptchaVerifier, CaptchaVerifyInput } from "./captcha-verifier";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

interface RecaptchaResponse {
  success?: boolean;
  score?: number;
  action?: string;
}

@Injectable()
export class RecaptchaVerifier implements CaptchaVerifier {
  readonly required = true;
  private readonly logger = new Logger(RecaptchaVerifier.name);

  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  async assertHuman(input: CaptchaVerifyInput): Promise<void> {
    if (input.token === undefined || input.token.length === 0) {
      throw this.rejected("Captcha verification is required");
    }

    const secret = this.config.get("RECAPTCHA_SECRET_KEY", { infer: true });
    const body = new URLSearchParams({ secret, response: input.token });
    if (input.ip !== null && input.ip.length > 0) {
      body.set("remoteip", input.ip);
    }

    let payload: RecaptchaResponse;
    try {
      const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      payload = (await response.json()) as RecaptchaResponse;
    } catch {
      // Never log the token. A verifier outage must not become an open door.
      this.logger.error("reCAPTCHA verification request failed");
      throw new HasutHttpException(
        "SERVICE_UNAVAILABLE",
        "Captcha verification is temporarily unavailable",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (payload.success !== true) {
      throw this.rejected("Captcha verification failed");
    }
    // v2 checkbox responses carry no score; only enforce the threshold for v3.
    if (typeof payload.score === "number") {
      const minScore = this.config.get("RECAPTCHA_MIN_SCORE", { infer: true });
      if (payload.score < minScore) {
        throw this.rejected("Captcha verification failed");
      }
    }
  }

  private rejected(message: string): HasutHttpException {
    return new HasutHttpException("VALIDATION_ERROR", message, HttpStatus.BAD_REQUEST);
  }
}
