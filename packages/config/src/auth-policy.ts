export interface AuthPolicy {
  otpExpirySeconds: number;
  resendCooldownSeconds: number;
  maxAttempts: number;
  maxChallengesPerPhonePerHour: number;
  maxChallengesPerIpPerHour: number;
  codeLength: number;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  maxDevices: number;
}

export const AUTH_POLICY_CONFIG_KEY = "auth.policy";

/** Seed / fallback values owned by configuration, not auth use-cases. */
export const AUTH_POLICY_DEFAULTS: AuthPolicy = {
  otpExpirySeconds: 300,
  resendCooldownSeconds: 60,
  maxAttempts: 5,
  maxChallengesPerPhonePerHour: 5,
  maxChallengesPerIpPerHour: 20,
  codeLength: 6,
  accessTtlSeconds: 900,
  refreshTtlSeconds: 2_592_000,
  maxDevices: 10,
};

export function isAuthPolicy(value: unknown): value is AuthPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys: Array<keyof AuthPolicy> = [
    "otpExpirySeconds",
    "resendCooldownSeconds",
    "maxAttempts",
    "maxChallengesPerPhonePerHour",
    "maxChallengesPerIpPerHour",
    "codeLength",
    "accessTtlSeconds",
    "refreshTtlSeconds",
    "maxDevices",
  ];
  return keys.every((key) => typeof record[key] === "number" && Number.isFinite(record[key]));
}
