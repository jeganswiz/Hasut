export const MEMBER_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MEMBER_ROLES = ["MEMBER", "ADMIN", "SUPPORT_AGENT", "MODERATOR"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const OTP_PURPOSES = ["LOGIN", "REAUTH"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const OTP_PROVIDERS = ["console", "msg91", "twilio"] as const;
export type OtpProviderName = (typeof OTP_PROVIDERS)[number];

export interface OtpChallengeReceipt {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
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
  phoneE164: string;
  status: MemberStatus;
  roles: MemberRole[];
  createdAt: string;
}

export interface AuthVerifyResult {
  member: CurrentMember;
  tokens: AuthTokens;
}

export interface LogoutResult {
  revoked: boolean;
}

export interface LogoutAllResult {
  revokedCount: number;
}
