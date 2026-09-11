import { OTP_PURPOSES } from "@hasut/types";
import { isE164Phone, normalizePhoneE164 } from "@hasut/utils";
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

export const otpPurposeSchema = z.enum(OTP_PURPOSES).default("LOGIN");

export const otpCodeSchema = z.string().regex(/^\d{4,8}$/, "OTP must be 4–8 digits");

export const deviceIdSchema = z.string().min(1).max(128).optional();

export const otpRequestSchema = z.object({
  phone: phoneE164Schema,
  purpose: otpPurposeSchema,
  deviceId: deviceIdSchema,
});

export const otpVerifySchema = z.object({
  phone: phoneE164Schema,
  code: otpCodeSchema,
  purpose: otpPurposeSchema,
  deviceId: deviceIdSchema,
});

export const otpResendSchema = z.object({
  phone: phoneE164Schema,
  purpose: otpPurposeSchema,
  deviceId: deviceIdSchema,
});

export const tokenRefreshSchema = z.object({
  refreshToken: z.string().min(20).max(512),
  deviceId: deviceIdSchema,
});

export const logoutSchema = z.object({
  sessionId: z.string().uuid().optional(),
});

export const otpChallengeReceiptSchema = z.object({
  challengeId: z.string().min(1),
  expiresAt: z.string().min(1),
  resendAvailableAt: z.string().min(1),
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
  phoneE164: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]),
  roles: z.array(z.enum(["MEMBER", "ADMIN", "SUPPORT_AGENT", "MODERATOR"])),
  createdAt: z.string().min(1),
});

export const authVerifyResultSchema = z.object({
  member: currentMemberSchema,
  tokens: authTokensSchema,
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
