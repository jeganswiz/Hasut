import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../../config/env";
import { CAPTCHA_VERIFIER } from "./captcha-verifier";
import { NoopCaptchaVerifier } from "./noop-captcha.verifier";
import { RecaptchaVerifier } from "./recaptcha.verifier";

export const captchaVerifierFactory: Provider = {
  provide: CAPTCHA_VERIFIER,
  inject: [ConfigService],
  useFactory: (config: ConfigService<ApiEnv, true>) => {
    if (config.get("CAPTCHA_PROVIDER", { infer: true }) === "recaptcha") {
      return new RecaptchaVerifier(config);
    }
    return new NoopCaptchaVerifier();
  },
};
