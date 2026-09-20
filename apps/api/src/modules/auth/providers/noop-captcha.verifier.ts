import { Injectable } from "@nestjs/common";
import type { CaptchaVerifier, CaptchaVerifyInput } from "./captcha-verifier";

/**
 * Local and test only. `CAPTCHA_PROVIDER=none` is rejected by the env schema in
 * production, so this can never be the live verifier.
 */
@Injectable()
export class NoopCaptchaVerifier implements CaptchaVerifier {
  readonly required = false;

  async assertHuman(_input: CaptchaVerifyInput): Promise<void> {
    return undefined;
  }
}
