import type { AuthClientConfig } from "@hasut/types";
import { loadScript } from "./script-loader";

interface Grecaptcha {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

function grecaptcha(): Grecaptcha | undefined {
  return (globalThis as { grecaptcha?: Grecaptcha }).grecaptcha;
}

/**
 * Returns a token for the given action, or undefined when the deployment runs
 * without a captcha. The API decides whether a token is mandatory.
 */
export async function captchaToken(
  config: AuthClientConfig | null,
  action: string,
): Promise<string | undefined> {
  if (config === null || config.captcha.provider !== "recaptcha") {
    return undefined;
  }
  const siteKey = config.captcha.siteKey;
  if (siteKey.length === 0) {
    return undefined;
  }

  await loadScript(`https://www.google.com/recaptcha/api.js?render=${siteKey}`);
  const api = grecaptcha();
  if (api === undefined) {
    return undefined;
  }
  await new Promise<void>((resolve) => api.ready(resolve));
  return api.execute(siteKey, { action });
}
