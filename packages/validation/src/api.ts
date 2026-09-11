import { ERROR_CODES } from "@hasut/types";
import { z } from "zod";

export const errorCodeSchema = z.enum(ERROR_CODES);

export const apiMetaSchema = z.object({
  requestId: z.string().min(1),
  pagination: z
    .object({
      cursor: z.string(),
      hasMore: z.boolean(),
    })
    .optional(),
});

export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: apiMetaSchema,
  });

export const apiFailureSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.unknown()).optional(),
  }),
  meta: apiMetaSchema,
});

export const probeStatusSchema = z.enum(["up", "down"]);

export const healthDataSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  scope: z.enum(["live", "ready"]),
  service: z.string().min(1),
  version: z.string().min(1),
  uptimeSeconds: z.number().nonnegative(),
  checks: z
    .object({
      postgres: probeStatusSchema,
      postgis: probeStatusSchema,
      redis: probeStatusSchema,
    })
    .optional(),
  postgisVersion: z.string().optional(),
});
