import { LIVE_SESSION_STATUSES, STORY_KINDS, STORY_MODERATION_STATUSES } from "@hasut/types";
import { z } from "zod";

export const storyCreateSchema = z.object({
  kind: z.enum(["IMAGE", "VIDEO"]),
  imageMediaId: z.string().uuid().optional(),
  videoMediaId: z.string().uuid().optional(),
  audioMediaId: z.string().uuid().nullable().optional(),
  trimStartSeconds: z.number().nonnegative().optional(),
  trimEndSeconds: z.number().positive().optional(),
});

export const storyViewSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  kind: z.enum(STORY_KINDS),
  imageUrl: z.string().nullable(),
  hlsUrl: z.string().nullable(),
  previewHlsUrl: z.string().nullable(),
  audioUrl: z.string().nullable(),
  expiresAt: z.string(),
  moderationStatus: z.enum(STORY_MODERATION_STATUSES),
  createdAt: z.string(),
});

export const storyListSchema = z.array(storyViewSchema);

export const liveStartSchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
});

export const liveSessionViewSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  status: z.enum(LIVE_SESSION_STATUSES),
  hlsUrl: z.string().nullable(),
  previewHlsUrl: z.string().nullable(),
  ingestUrl: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});

export const liveSessionListSchema = z.array(liveSessionViewSchema);

export const storyModerateSchema = z.object({
  hidden: z.boolean(),
});
