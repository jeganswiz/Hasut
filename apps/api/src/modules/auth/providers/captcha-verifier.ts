export const CAPTCHA_VERIFIER = Symbol("CAPTCHA_VERIFIER");

/** Where a captcha token was solved. Lets us score actions separately. */
export type CaptchaAction =
  | "otp_request"
  | "otp_resend"
  | "password_login"
  | "password_register"
  | "password_forgot"
  | "sso_login";

export interface CaptchaVerifyInput {
  token: string | undefined;
  action: CaptchaAction;
  ip: string | null;
}

export interface CaptchaVerifier {
  /** False when the surface is unprotected, so callers can skip the check. */
  readonly required: boolean;
  assertHuman(input: CaptchaVerifyInput): Promise<void>;
}
