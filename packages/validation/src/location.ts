import { LOCATION_PERMISSIONS } from "@hasut/types";
import { z } from "zod";
import { approximateLocationSchema } from "./profile";

export const locationUpdateSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracyMeters: z.number().positive().max(50_000).optional(),
});

export const locationPermissionSchema = z.object({
  status: z.enum(LOCATION_PERMISSIONS),
});

export const exactLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracyMeters: z.number().nullable(),
  updatedAt: z.string().min(1),
});

export const ownerLocationSchema = z.object({
  permission: z.enum(LOCATION_PERMISSIONS),
  exact: exactLocationSchema.nullable(),
  approximate: approximateLocationSchema.nullable(),
});
