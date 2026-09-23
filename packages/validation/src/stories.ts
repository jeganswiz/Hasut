import {
  LIVE_SESSION_STATUSES,
  STORY_AUDIENCES,
  STORY_AUDIO_SOURCES,
  STORY_CAPTION_MAX_LENGTH,
  STORY_KINDS,
  STORY_MODERATION_STATUSES,
  STORY_ORIGINAL_AUDIO_MODES,
  STORY_PLAYBACK_STATUSES,
} from "@hasut/types";
import { z } from "zod";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const storyAudioSourceSchema = z.enum(STORY_AUDIO_SOURCES);
export const storyOriginalAudioModeSchema = z.enum(STORY_ORIGINAL_AUDIO_MODES);
export const storyAudienceSchema = z.enum(STORY_AUDIENCES);
export const storyPlaybackStatusSchema = z.enum(STORY_PLAYBACK_STATUSES);

/**
 * The composer sends one audio block rather than loose fields, so an impossible
 * combination (a library id with an uploaded file) cannot be expressed at all.
 */
export const storyAudioInputSchema = z
  .object({
    source: storyAudioSourceSchema.default("NONE"),
    trackId: z.string().uuid().nullable().optional(),
    mediaId: z.string().uuid().nullable().optional(),
    startSeconds: z.number().nonnegative().max(3600).default(0),
    endSeconds: z.number().positive().max(3600).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.source === "LIBRARY" && (value.trackId ?? null) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackId"],
        message: "Choose a track from the HASUT library",
      });
    }
    if (value.source === "UPLOAD" && (value.mediaId ?? null) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaId"],
        message: "Upload an audio file",
      });
    }
    if (
      value.source === "NONE" &&
      ((value.trackId ?? null) !== null || (value.mediaId ?? null) !== null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source"],
        message: "Remove the audio selection or choose a source",
      });
    }
    if (
      value.endSeconds !== undefined &&
      value.endSeconds !== null &&
      value.endSeconds <= value.startSeconds
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endSeconds"],
        message: "The audio must end after it starts",
      });
    }
  });

export const storyCreateSchema = z
  .object({
    kind: z.enum(["IMAGE", "VIDEO"]),
    imageMediaId: z.string().uuid().optional(),
    videoMediaId: z.string().uuid().optional(),
    caption: z.string().trim().max(STORY_CAPTION_MAX_LENGTH).default(""),
    captionColor: z
      .string()
      .regex(HEX_COLOR, "Pick a colour from the palette")
      .nullable()
      .optional(),
    audio: storyAudioInputSchema.optional(),
    originalAudioMode: storyOriginalAudioModeSchema.default("KEEP"),
    audience: storyAudienceSchema.default("EVERYONE"),
    trimStartSeconds: z.number().nonnegative().max(3600).default(0),
    trimEndSeconds: z.number().positive().max(3600).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "IMAGE" && value.imageMediaId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageMediaId"],
        message: "An image is required",
      });
    }
    if (value.kind === "VIDEO" && value.videoMediaId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["videoMediaId"],
        message: "A video is required",
      });
    }
    if (
      value.trimEndSeconds !== undefined &&
      value.trimEndSeconds !== null &&
      value.trimEndSeconds <= value.trimStartSeconds
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trimEndSeconds"],
        message: "The clip must end after it starts",
      });
    }
    // Muting or layering a soundtrack is meaningless on a still image.
    if (value.kind === "IMAGE" && value.originalAudioMode !== "KEEP") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originalAudioMode"],
        message: "An image story has no original sound",
      });
    }
    if (value.originalAudioMode === "OVERLAY" && (value.audio?.source ?? "NONE") === "NONE") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originalAudioMode"],
        message: "Choose a track to layer over the original sound",
      });
    }
  });

export const storyAudioViewSchema = z.object({
  source: storyAudioSourceSchema,
  trackId: z.string().nullable(),
  title: z.string().nullable(),
  url: z.string().nullable(),
  startSeconds: z.number(),
  endSeconds: z.number().nullable(),
});

export const storyViewSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  kind: z.enum(STORY_KINDS),
  imageUrl: z.string().nullable(),
  hlsUrl: z.string().nullable(),
  previewHlsUrl: z.string().nullable(),
  audioUrl: z.string().nullable(),
  audio: storyAudioViewSchema,
  caption: z.string(),
  captionColor: z.string().nullable(),
  trimStartSeconds: z.number(),
  trimEndSeconds: z.number().nullable(),
  originalAudioMode: storyOriginalAudioModeSchema,
  audience: storyAudienceSchema,
  playbackStatus: storyPlaybackStatusSchema,
  expiresAt: z.string(),
  moderationStatus: z.enum(STORY_MODERATION_STATUSES),
  createdAt: z.string(),
});

export const storyListSchema = z.array(storyViewSchema);

export const audioTrackViewSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  artist: z.string(),
  durationSeconds: z.number(),
  audioUrl: z.string().nullable(),
  mood: z.string(),
  isActive: z.boolean(),
});

export const audioTrackListSchema = z.array(audioTrackViewSchema);

export const audioTrackUpsertSchema = z.object({
  title: z.string().trim().min(1).max(80),
  artist: z.string().trim().min(1).max(80),
  mediaId: z.string().uuid(),
  durationSeconds: z.number().positive().max(3600),
  mood: z.string().trim().min(1).max(40),
  isActive: z.boolean().default(true),
});

export const storyComposerConfigSchema = z.object({
  captionMaxLength: z.number(),
  captionColors: z.array(z.string()),
  maxVideoDurationSeconds: z.number(),
  maxAudioSegmentSeconds: z.number(),
  audioLibraryEnabled: z.boolean(),
  patronCount: z.number(),
  maxActiveStories: z.number(),
  storyTtlHours: z.number(),
});

export const liveStartSchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
  audience: storyAudienceSchema.default("EVERYONE"),
});

export const liveSessionViewSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  title: z.string(),
  audience: storyAudienceSchema,
  status: z.enum(LIVE_SESSION_STATUSES),
  hlsUrl: z.string().nullable(),
  previewHlsUrl: z.string().nullable(),
  ingestUrl: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});

export const liveSessionListSchema = z.array(liveSessionViewSchema);

/** Current live for a member — `live` is null when they are not broadcasting. */
export const livePresenceViewSchema = z.object({
  live: liveSessionViewSchema.nullable(),
});

export const storyModerateSchema = z.object({
  hidden: z.boolean(),
});
