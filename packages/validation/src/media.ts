import { MEDIA_PURPOSES, MEDIA_STATUSES } from "@hasut/types";
import { z } from "zod";

export const mediaPresignSchema = z.object({
  purpose: z.enum(MEDIA_PURPOSES),
  mimeType: z.string().min(1).max(128),
  byteSize: z.number().int().positive().max(20_971_520),
});

export const mediaCompleteSchema = z.object({
  mediaId: z.string().uuid(),
});

export const mediaPresignResultSchema = z.object({
  mediaId: z.string().min(1),
  uploadUrl: z.string().min(1),
  objectKey: z.string().min(1),
  headers: z.record(z.string()),
  expiresAt: z.string().min(1),
});

export const mediaAssetViewSchema = z.object({
  id: z.string().min(1),
  purpose: z.enum(MEDIA_PURPOSES),
  status: z.enum(MEDIA_STATUSES),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  url: z.string().nullable(),
});
