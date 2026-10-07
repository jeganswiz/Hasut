import { MEDIA_PURPOSES, MEDIA_STATUSES } from "@hasut/types";
import { z } from "zod";

/** Avatars, chat, and other small uploads. */
export const MEDIA_UPLOAD_MAX_BYTES = 20_971_520;

/**
 * Story video and audio are limited by duration in story policy.
 * A minute and a half of phone video does not fit in the small upload ceiling.
 */
export const STORY_MEDIA_MAX_BYTES = 512 * 1024 * 1024;

export function mediaUploadMaxBytes(purpose: string): number {
  if (purpose === "STORY_VIDEO" || purpose === "STORY_AUDIO") {
    return STORY_MEDIA_MAX_BYTES;
  }
  return MEDIA_UPLOAD_MAX_BYTES;
}

export const mediaPresignSchema = z
  .object({
    purpose: z.enum(MEDIA_PURPOSES),
    mimeType: z.string().min(1).max(128),
    byteSize: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (value.byteSize > mediaUploadMaxBytes(value.purpose)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["byteSize"],
        message: "File is too large",
      });
    }
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
