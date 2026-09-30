import type { Page, Response } from "@playwright/test";

export function envelope(data: unknown): {
  success: true;
  data: unknown;
  meta: { requestId: string };
} {
  return { success: true, data, meta: { requestId: "e2e-critical" } };
}

export const THEME = {
  version: 1,
  tokens: {
    primary: "#6D28D9",
    secondary: "#4C1D95",
    accent: "#EAB308",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    text: "#0F172A",
    mutedText: "#64748B",
    textOnPrimary: "#FFFFFF",
    success: "#15803D",
    warning: "#C2410C",
    danger: "#DC2626",
    border: "#E2E8F0",
    radius: "12px",
    buttonRadius: "14px",
    cardRadius: "16px",
  },
  logoUrl: null,
};

export const AUTH_CONFIG = {
  captcha: { provider: "none" as const, required: false, siteKey: "" },
  sso: {
    google: { enabled: false, clientId: "" },
    facebook: { enabled: false, appId: "" },
  },
  passwordMinLength: 10,
  codeLength: 6,
  resendCooldownSeconds: 30,
};

export function otpReceipt() {
  return {
    challengeId: "challenge-1",
    channel: "SMS" as const,
    destinationHint: "••8490",
    expiresAt: "2099-01-01T00:00:00.000Z",
    resendAvailableAt: "2099-01-01T00:00:00.000Z",
    codeLength: 6,
    debugCode: "123456",
  };
}

export function member(roles: string[] = ["MEMBER"]) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    phoneE164: null,
    email: roles.includes("ADMIN") ? "admin@hasut.local" : null,
    emailVerified: true,
    hasPassword: true,
    twoFactorEnabled: roles.includes("ADMIN"),
    status: "ACTIVE" as const,
    roles,
    createdAt: "2026-09-01T00:00:00.000Z",
  };
}

export function tokens() {
  return {
    accessToken: "e2e-access",
    refreshToken: "e2e-refresh",
    expiresIn: 900,
    tokenType: "Bearer" as const,
  };
}

export function session(roles: string[] = ["MEMBER"]) {
  return {
    status: "AUTHENTICATED" as const,
    member: member(roles),
    tokens: tokens(),
  };
}

/** Wait until the client auth form has fetched config so hydration will not wipe filled fields. */
export function waitForAuthConfig(page: Page): Promise<Response> {
  return page.waitForResponse((response) => response.url().includes("/auth/config"));
}
