import {
  CAPTCHA_PROVIDERS,
  IDENTITY_PROVIDERS,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  OTP_CHANNELS,
  OTP_PURPOSES,
} from "@hasut/types";
import {
  isE164Phone,
  isEmail,
  normalizeEmail,
  normalizePhoneE164,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@hasut/utils";
import { z } from "zod";

export const phoneE164Schema = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    if (!isE164Phone(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Phone must be E.164" });
      return z.NEVER;
    }
    return normalizePhoneE164(value);
  });

export const emailSchema = z
  .string()
  .min(1)
  .max(254)
  .transform((value, ctx) => {
    if (!isEmail(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid email address" });
      return z.NEVER;
    }
    return normalizeEmail(value);
  });

/**
 * Contract floor only. `AuthPolicy.passwordMinLength` may raise the bar, and the
 * service enforces that; it can never lower this.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH);

export const captchaTokenSchema = z.string().min(1).max(4096).optional();

export const otpPurposeSchema = z.enum(OTP_PURPOSES).default("LOGIN");
export const otpChannelSchema = z.enum(OTP_CHANNELS);
export const identityProviderSchema = z.enum(IDENTITY_PROVIDERS);

export const otpCodeSchema = z.string().regex(/^\d{4,8}$/, "OTP must be 4–8 digits");

export const deviceIdSchema = z.string().min(1).max(128).optional();

const exactlyOneDestination = <T extends { phone?: string; email?: string }>(
  value: T,
  ctx: z.RefinementCtx,
): void => {
  const provided = [value.phone, value.email].filter((entry) => entry !== undefined).length;
  if (provided !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide exactly one of phone or email",
      path: ["phone"],
    });
  }
};

const otpDestinationShape = {
  phone: phoneE164Schema.optional(),
  email: emailSchema.optional(),
  purpose: otpPurposeSchema,
  deviceId: deviceIdSchema,
  captchaToken: captchaTokenSchema,
};

export const otpRequestSchema = z.object(otpDestinationShape).superRefine(exactlyOneDestination);

export const otpResendSchema = z.object(otpDestinationShape).superRefine(exactlyOneDestination);

export const otpVerifySchema = z
  .object({ ...otpDestinationShape, code: otpCodeSchema })
  .superRefine(exactlyOneDestination);

export const tokenRefreshSchema = z.object({
  refreshToken: z.string().min(20).max(512),
  deviceId: deviceIdSchema,
});

export const logoutSchema = z.object({
  sessionId: z.string().uuid().optional(),
});

export const passwordRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80),
  phone: phoneE164Schema.optional(),
  deviceId: deviceIdSchema,
  captchaToken: captchaTokenSchema,
});

export const passwordLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  deviceId: deviceIdSchema,
  captchaToken: captchaTokenSchema,
});

/** Second step of a two-step sign in. Keyed by challenge, never by account. */
export const twoFactorVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: otpCodeSchema,
  deviceId: deviceIdSchema,
  captchaToken: captchaTokenSchema,
});

export const passwordForgotSchema = z
  .object({
    phone: phoneE164Schema.optional(),
    email: emailSchema.optional(),
    captchaToken: captchaTokenSchema,
  })
  .superRefine(exactlyOneDestination);

export const passwordResetVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: otpCodeSchema,
  captchaToken: captchaTokenSchema,
});

export const passwordResetSchema = z.object({
  ticket: z.string().min(20).max(4096),
  password: passwordSchema,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  password: passwordSchema,
});

export const ssoLoginSchema = z.object({
  provider: identityProviderSchema,
  token: z.string().min(1).max(8192),
  deviceId: deviceIdSchema,
  captchaToken: captchaTokenSchema,
});

export const twoFactorSettingSchema = z.object({
  enabled: z.boolean(),
});

export const otpChallengeReceiptSchema = z.object({
  challengeId: z.string().min(1),
  channel: otpChannelSchema,
  destinationHint: z.string().min(1),
  expiresAt: z.string().min(1),
  resendAvailableAt: z.string().min(1),
  codeLength: z.number().int().positive(),
  debugCode: z.string().optional(),
});

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
});

export const currentMemberSchema = z.object({
  id: z.string().min(1),
  phoneE164: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  hasPassword: z.boolean(),
  twoFactorEnabled: z.boolean(),
  status: z.enum(MEMBER_STATUSES),
  roles: z.array(z.enum(MEMBER_ROLES)),
  createdAt: z.string().min(1),
});

export const authVerifyResultSchema = z.object({
  member: currentMemberSchema,
  tokens: authTokensSchema,
});

export const authLoginResultSchema = z.discriminatedUnion("status", [
  authVerifyResultSchema.extend({ status: z.literal("AUTHENTICATED") }),
  z.object({
    status: z.literal("TWO_FACTOR_REQUIRED"),
    challenge: otpChallengeReceiptSchema,
  }),
]);

export const passwordResetTicketSchema = z.object({
  ticket: z.string().min(1),
  expiresAt: z.string().min(1),
});

export const passwordUpdateResultSchema = z.object({
  updated: z.boolean(),
  revokedSessionCount: z.number().int().nonnegative(),
});

export const authClientConfigSchema = z.object({
  captcha: z.object({
    provider: z.enum(CAPTCHA_PROVIDERS),
    required: z.boolean(),
    siteKey: z.string(),
  }),
  sso: z.object({
    google: z.object({ enabled: z.boolean(), clientId: z.string() }),
    facebook: z.object({ enabled: z.boolean(), appId: z.string() }),
  }),
  passwordMinLength: z.number().int().positive(),
  codeLength: z.number().int().positive(),
  resendCooldownSeconds: z.number().int().nonnegative(),
});

export const authSessionViewSchema = z.object({
  id: z.string().min(1),
  deviceId: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  lastSeenAt: z.string().min(1),
  createdAt: z.string().min(1),
  current: z.boolean(),
});

export const authSessionListSchema = z.array(authSessionViewSchema);

export const logoutResultSchema = z.object({
  revoked: z.boolean(),
});

export const logoutAllResultSchema = z.object({
  revokedCount: z.number().int().nonnegative(),
});
