import { apiErrorMessage, hasutErrorCode } from "@hasut/api-client";
import type { AuthClientConfig } from "@hasut/types";

/** Every auth surface renders exactly one of these. */
export type AuthStatus = "idle" | "loading" | "error" | "success";

export interface AuthFeedback {
  status: AuthStatus;
  message: string;
}

export const IDLE: AuthFeedback = { status: "idle", message: "" };

export function loading(message: string): AuthFeedback {
  return { status: "loading", message };
}

export function success(message: string): AuthFeedback {
  return { status: "success", message };
}

/**
 * Turns an API failure into copy a member can act on. Falls back to the
 * envelope message so server-side wording stays authoritative.
 */
export function failure(error: unknown, fallback: string): AuthFeedback {
  const code = hasutErrorCode(error);
  if (code === "RATE_LIMITED") {
    return {
      status: "error",
      message: "Too many attempts. Wait a few minutes and try again.",
    };
  }
  if (code === "OTP_RESEND_COOLDOWN") {
    return { status: "error", message: "A code was just sent. Wait before asking for another." };
  }
  if (code === "OTP_INVALID") {
    return { status: "error", message: "That code is not right. Check it and try again." };
  }
  if (code === "OTP_EXPIRED") {
    return { status: "error", message: "That code expired. Send a new one." };
  }
  if (code === "OTP_ATTEMPTS_EXCEEDED") {
    return { status: "error", message: "Too many wrong codes. Start again with a new one." };
  }
  return { status: "error", message: apiErrorMessage(error, fallback) };
}

/** Seconds remaining before a resend is allowed, floored at zero. */
export function cooldownSeconds(resendAvailableAt: string | null, now = Date.now()): number {
  if (resendAvailableAt === null) {
    return 0;
  }
  const remaining = Math.ceil((new Date(resendAvailableAt).getTime() - now) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function ssoAvailable(config: AuthClientConfig | null): boolean {
  return config !== null && (config.sso.google.enabled || config.sso.facebook.enabled);
}
