export const MEMBER_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MEMBER_ROLES = ["MEMBER", "ADMIN", "SUPPORT_AGENT", "MODERATOR"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const OTP_PURPOSES = ["LOGIN", "REAUTH", "PASSWORD_RESET", "TWO_FACTOR"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** Where a one-time code is delivered. Identity, never a second account. */
export const OTP_CHANNELS = ["SMS", "EMAIL"] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export const OTP_PROVIDERS = ["console", "msg91", "twilio"] as const;
export type OtpProviderName = (typeof OTP_PROVIDERS)[number];

export const EMAIL_PROVIDERS = ["console", "smtp"] as const;
export type EmailProviderName = (typeof EMAIL_PROVIDERS)[number];

export const CAPTCHA_PROVIDERS = ["none", "recaptcha"] as const;
export type CaptchaProviderName = (typeof CAPTCHA_PROVIDERS)[number];

export const IDENTITY_PROVIDERS = ["GOOGLE", "FACEBOOK"] as const;
export type IdentityProviderName = (typeof IDENTITY_PROVIDERS)[number];

export interface OtpChallengeReceipt {
  challengeId: string;
  channel: OtpChannel;
  /** Masked destination for UI copy. Never the full phone or email. */
  destinationHint: string;
  expiresAt: string;
  resendAvailableAt: string;
  codeLength: number;
  debugCode?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface AuthSessionView {
  id: string;
  deviceId: string | null;
  ip: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
}

export interface CurrentMember {
  id: string;
  /** Null until the member adds a phone. Email-first and SSO members start without one. */
  phoneE164: string | null;
  email: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  status: MemberStatus;
  roles: MemberRole[];
  createdAt: string;
}

export interface AuthVerifyResult {
  member: CurrentMember;
  tokens: AuthTokens;
}

/**
 * Password sign-in either completes or stops for a second factor.
 * The pending branch carries no tokens, so a stolen password alone is useless.
 */
export interface AuthAuthenticated extends AuthVerifyResult {
  status: "AUTHENTICATED";
}

export interface AuthTwoFactorRequired {
  status: "TWO_FACTOR_REQUIRED";
  challenge: OtpChallengeReceipt;
}

export type AuthLoginResult = AuthAuthenticated | AuthTwoFactorRequired;

/** Short-lived proof that a reset OTP was verified. Exchanged for a new password. */
export interface PasswordResetTicket {
  ticket: string;
  expiresAt: string;
}

export interface PasswordUpdateResult {
  updated: boolean;
  revokedSessionCount: number;
}

/**
 * Client-visible auth configuration. Site keys and enabled providers come from
 * here so login screens never hardcode them.
 */
export interface AuthClientConfig {
  captcha: {
    provider: CaptchaProviderName;
    required: boolean;
    siteKey: string;
  };
  sso: {
    /** Public client identifiers. Provider secrets never leave the API. */
    google: { enabled: boolean; clientId: string };
    facebook: { enabled: boolean; appId: string };
  };
  passwordMinLength: number;
  codeLength: number;
  resendCooldownSeconds: number;
}

export interface LogoutResult {
  revoked: boolean;
}

export interface LogoutAllResult {
  revokedCount: number;
}
