import {
  LIVE_END_REASONS,
  LIVE_HEALTH_STATES,
  LIVE_RECORDING_STATUSES,
  LIVE_SESSION_STATUSES,
  STORY_AUDIENCES,
  STORY_COMPOSER_AUDIENCES,
  STORY_AUDIO_SOURCES,
  STORY_CAPTION_MAX_LENGTH,
  STORY_KINDS,
  STORY_TTL_HOUR_OPTIONS,
  STORY_MODERATION_STATUSES,
  STORY_ORIGINAL_AUDIO_MODES,
  STORY_PLAYBACK_STATUSES,
} from "@hasut/types";
import { z } from "zod";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const storyAudioSourceSchema = z.enum(STORY_AUDIO_SOURCES);
export const storyOriginalAudioModeSchema = z.enum(STORY_ORIGINAL_AUDIO_MODES);
export const storyAudienceSchema = z.enum(STORY_AUDIENCES);
/** Photo and video stories cannot be PRIVATE; that audience belongs to lives and replays. */
export const storyComposerAudienceSchema = z.enum(STORY_COMPOSER_AUDIENCES);
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
    captionX: z.number().min(0).max(100).nullable().optional(),
    captionY: z.number().min(0).max(100).nullable().optional(),
    captionW: z.number().min(0).max(100).nullable().optional(),
    audio: storyAudioInputSchema.optional(),
    originalAudioMode: storyOriginalAudioModeSchema.default("KEEP"),
    audience: storyComposerAudienceSchema.default("EVERYONE"),
    ttlHours: z
      .number()
      .int()
      .refine((value) => (STORY_TTL_HOUR_OPTIONS as readonly number[]).includes(value), {
        message: "Choose 4, 8, 12, or 24 hours",
      })
      .optional(),
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
  captionX: z.number().nullable(),
  captionY: z.number().nullable(),
  captionW: z.number().nullable(),
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

export const storyReplySchema = z.object({
  text: z.string().trim().min(1).max(2_000),
});

export const storyShareSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(20),
});

export const storyLikeStateSchema = z.object({
  liked: z.boolean(),
});

export const storyViewRecordSchema = z.object({
  recorded: z.boolean(),
});

export const storyReplyResultSchema = z.object({
  sent: z.literal(true),
});

export const storyShareResultSchema = z.object({
  sent: z.number().int().nonnegative(),
});

export const storyViewerListSchema = z.object({
  viewers: z.array(
    z.object({
      member: z.object({
        id: z.string().uuid(),
        displayName: z.string(),
        photoUrl: z.string().nullable(),
      }),
      liked: z.boolean(),
      viewedAt: z.string(),
    }),
  ),
});

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

/** Upper bounds here are belt and braces; the live policy sets the real caps in the service. */
const LIVE_TITLE_HARD_MAX = 200;
const LIVE_DESCRIPTION_HARD_MAX = 2_000;
const LIVE_BLOCKED_WORDS_MAX = 100;
const LIVE_SLOW_MODE_MAX_SECONDS = 600;

const liveSettingsFields = {
  title: z.string().trim().max(LIVE_TITLE_HARD_MAX).optional(),
  description: z.string().trim().max(LIVE_DESCRIPTION_HARD_MAX).optional(),
  category: z.string().trim().max(40).nullable().optional(),
  thumbnailMediaId: z.string().uuid().nullable().optional(),
  chatEnabled: z.boolean().optional(),
  chatPatronsOnly: z.boolean().optional(),
  slowModeSeconds: z.number().int().min(0).max(LIVE_SLOW_MODE_MAX_SECONDS).optional(),
  blockedWords: z.array(z.string().trim().min(1).max(40)).max(LIVE_BLOCKED_WORDS_MAX).optional(),
};

export const liveSettingsSchema = z.object(liveSettingsFields);

export const liveStartSchema = z.object({
  ...liveSettingsFields,
  audience: storyAudienceSchema.default("EVERYONE"),
  inviteeIds: z.array(z.string().uuid()).max(500).optional(),
  recordingEnabled: z.boolean().optional(),
  scheduledId: z.string().uuid().optional(),
});

export const liveScheduleSchema = z.object({
  ...liveSettingsFields,
  audience: storyAudienceSchema.default("EVERYONE"),
  inviteeIds: z.array(z.string().uuid()).max(500).optional(),
  recordingEnabled: z.boolean().optional(),
  scheduledFor: z.string().datetime(),
});

export const liveModeratorsSchema = z.object({
  memberIds: z.array(z.string().uuid()).max(50),
});

export const liveHostPreviewSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  photoUrl: z.string().nullable(),
});

export const liveSessionViewSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  host: liveHostPreviewSchema,
  title: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  audience: storyAudienceSchema,
  status: z.enum(LIVE_SESSION_STATUSES),
  scheduledFor: z.string().nullable(),
  hlsUrl: z.string().nullable(),
  previewHlsUrl: z.string().nullable(),
  ingestUrl: z.string().nullable(),
  chatEnabled: z.boolean(),
  chatPatronsOnly: z.boolean(),
  slowModeSeconds: z.number(),
  blockedWords: z.array(z.string()),
  recordingEnabled: z.boolean(),
  recordingStatus: z.enum(LIVE_RECORDING_STATUSES),
  replayStoryId: z.string().nullable(),
  viewerCount: z.number(),
  peakViewers: z.number(),
  totalViews: z.number(),
  reactionCount: z.number(),
  messageCount: z.number(),
  endedReason: z.enum(LIVE_END_REASONS).nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});

export const liveHealthViewSchema = z.object({
  state: z.enum(LIVE_HEALTH_STATES),
  streamReady: z.boolean(),
  tracks: z.array(z.string()),
  bitrateKbps: z.number().nullable(),
  viewerCount: z.number(),
  lastHeartbeatAt: z.string().nullable(),
  checkedAt: z.string(),
});

export const liveHeartbeatResultSchema = z.object({
  live: liveSessionViewSchema,
  health: liveHealthViewSchema,
});

export const liveSummaryViewSchema = z.object({
  live: liveSessionViewSchema,
  durationSeconds: z.number(),
  peakViewers: z.number(),
  totalViews: z.number(),
  reactionCount: z.number(),
  messageCount: z.number(),
  endedReason: z.enum(LIVE_END_REASONS).nullable(),
});

export const liveComposerConfigSchema = z.object({
  titleMaxLength: z.number(),
  descriptionMaxLength: z.number(),
  categories: z.array(z.string()),
  heartbeatSeconds: z.number(),
  chatMaxChars: z.number(),
  maxInvitees: z.number(),
  maxModerators: z.number(),
  maxScheduleDaysAhead: z.number(),
  recordingAvailable: z.boolean(),
  replayRetentionDays: z.number(),
  patronCount: z.number(),
  playlistPollSeconds: z.number(),
});

export const liveModeratorListSchema = z.object({
  moderators: z.array(liveHostPreviewSchema),
});

export const liveChatMessageViewSchema = z.object({
  id: z.string().min(1),
  liveId: z.string().min(1),
  member: liveHostPreviewSchema,
  body: z.string(),
  pinned: z.boolean(),
  isHost: z.boolean(),
  isPatron: z.boolean(),
  isModerator: z.boolean(),
  createdAt: z.string(),
});

export const liveChatPageSchema = z.object({
  messages: z.array(liveChatMessageViewSchema),
  nextCursor: z.string().nullable(),
  pinned: liveChatMessageViewSchema.nullable(),
});

export const liveChatSendSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
});

export const liveChatHideSchema = z.object({
  messageId: z.string().uuid(),
});

export const liveChatPinSchema = z.object({
  messageId: z.string().uuid().nullable(),
});

export const liveTimeoutSchema = z.object({
  memberId: z.string().uuid(),
  seconds: z.number().int().min(10).max(3_600).default(60),
});

export const liveReactionSchema = z.object({
  emoji: z.string().min(1).max(8),
});

export const liveReportSchema = z.object({
  reasonCode: z.string().min(1).max(40),
  details: z.string().max(2_000).default(""),
  messageId: z.string().uuid().optional(),
});

export const liveCardViewSchema = z.object({
  id: z.string().min(1),
  host: liveHostPreviewSchema,
  title: z.string(),
  category: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  previewHlsUrl: z.string().nullable(),
  audience: storyAudienceSchema,
  status: z.enum(["LIVE", "UPCOMING", "REPLAY"]),
  viewerCount: z.number(),
  scheduledFor: z.string().nullable(),
  distanceBucket: z.string().nullable(),
  href: z.string(),
});

export const liveDiscoverResultSchema = z.object({
  liveNow: z.array(liveCardViewSchema),
  patrons: z.array(liveCardViewSchema),
  upcoming: z.array(liveCardViewSchema),
  recommended: z.array(liveCardViewSchema),
  recentReplays: z.array(liveCardViewSchema),
});

export const liveSessionListSchema = z.array(liveSessionViewSchema);

export const liveReplaySchema = z.object({
  title: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  thumbnailMediaId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["EVERYONE", "PATRONS", "PRIVATE", "DISCARD"]).optional(),
});

export const liveReplayStatusSchema = z.object({
  liveId: z.string().min(1),
  recordingStatus: z.enum(["NONE", "RECORDING", "PROCESSING", "READY", "FAILED", "DISCARDED"]),
  replayStoryId: z.string().nullable(),
  replayHlsUrl: z.string().nullable(),
});

export const liveReminderStateSchema = z.object({
  creatorId: z.string().uuid(),
  reminded: z.boolean(),
});

export const liveMetricSchema = z.object({
  startupMs: z.number().int().min(0).max(120_000).optional(),
  fatalErrors: z.number().int().min(0).max(1_000).optional(),
  reconnects: z.number().int().min(0).max(1_000).optional(),
  droppedFrames: z.number().int().min(0).max(1_000_000).optional(),
});

export const liveMetricsSummarySchema = z.object({
  samples: z.number().int().min(0),
  avgStartupMs: z.number().nullable(),
  fatalErrors: z.number().int().min(0),
  reconnects: z.number().int().min(0),
  droppedFrames: z.number().int().min(0),
});

/** Current live for a member — `live` is null when they are not broadcasting. */
export const livePresenceViewSchema = z.object({
  live: liveSessionViewSchema.nullable(),
});

export const storyModerateSchema = z.object({
  hidden: z.boolean(),
});
