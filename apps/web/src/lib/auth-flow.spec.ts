import { HasutApiError } from "@hasut/api-client";
import type { AuthClientConfig } from "@hasut/types";
import { cooldownSeconds, failure, ssoAvailable } from "./auth-flow";

function apiError(code: string, message: string): HasutApiError {
  return new HasutApiError({
    success: false,
    error: { code: code as "RATE_LIMITED", message },
    meta: { requestId: "req-1" },
  });
}

const CONFIG: AuthClientConfig = {
  captcha: { provider: "none", required: false, siteKey: "" },
  sso: {
    google: { enabled: false, clientId: "" },
    facebook: { enabled: false, appId: "" },
  },
  passwordMinLength: 10,
  codeLength: 6,
  resendCooldownSeconds: 60,
};

describe("auth flow helpers", () => {
  it("rewrites throttling into advice the member can act on", () => {
    expect(failure(apiError("RATE_LIMITED", "Too many"), "fallback")).toEqual({
      status: "error",
      message: "Too many attempts. Wait a few minutes and try again.",
    });
  });

  it("explains an expired code instead of repeating the raw error", () => {
    expect(failure(apiError("OTP_EXPIRED", "expired"), "fallback").message).toBe(
      "That code expired. Send a new one.",
    );
  });

  it("falls back to the server message for unmapped codes", () => {
    expect(failure(apiError("CONFLICT", "An account already uses this email"), "fallback")).toEqual(
      { status: "error", message: "An account already uses this email" },
    );
  });

  it("uses the fallback for a non-API failure", () => {
    expect(failure(new Error("socket hang up"), "Unable to sign in.").message).toBe(
      "Unable to sign in.",
    );
  });

  it("counts down the resend window and never goes negative", () => {
    const now = Date.parse("2026-09-21T00:00:00.000Z");
    expect(cooldownSeconds("2026-09-21T00:00:45.000Z", now)).toBe(45);
    expect(cooldownSeconds("2026-09-20T23:59:00.000Z", now)).toBe(0);
    expect(cooldownSeconds(null, now)).toBe(0);
  });

  it("hides the SSO block when no provider is configured", () => {
    expect(ssoAvailable(null)).toBe(false);
    expect(ssoAvailable(CONFIG)).toBe(false);
    expect(
      ssoAvailable({
        ...CONFIG,
        sso: { ...CONFIG.sso, google: { enabled: true, clientId: "abc" } },
      }),
    ).toBe(true);
  });
});
