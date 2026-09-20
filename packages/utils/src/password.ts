/** Hard floor enforced by the contract. Configuration may raise it, never lower it. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordStrength = "weak" | "fair" | "strong";

const COMMON = [
  "password",
  "12345678",
  "qwertyuiop",
  "letmein",
  "iloveyou",
  "admin123",
  "welcome1",
  "hasut",
];

/**
 * Advisory meter for the UI. Acceptance is decided by the schema and the
 * service, not by this score.
 */
export function passwordStrength(value: string): PasswordStrength {
  const lower = value.toLowerCase();
  if (value.length < PASSWORD_MIN_LENGTH || COMMON.some((bad) => lower.includes(bad))) {
    return "weak";
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) =>
    rule.test(value),
  ).length;
  if (value.length >= 14 && classes >= 3) {
    return "strong";
  }
  return classes >= 3 ? "fair" : "weak";
}
