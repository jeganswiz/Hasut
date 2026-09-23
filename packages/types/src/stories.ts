export const STORY_KINDS = ["IMAGE", "VIDEO", "LIVE"] as const;
export type StoryKind = (typeof STORY_KINDS)[number];

export const STORY_MODERATION_STATUSES = ["ACTIVE", "HIDDEN"] as const;
export type StoryModerationStatus = (typeof STORY_MODERATION_STATUSES)[number];

export const LIVE_SESSION_STATUSES = ["LIVE", "ENDED"] as const;
export type LiveSessionStatus = (typeof LIVE_SESSION_STATUSES)[number];

/**
 * Where the soundtrack came from. `LIBRARY` is a HASUT-cloud track the member
 * picked; `UPLOAD` is a file they supplied. Keeping them apart matters because
 * only library tracks carry licensing we can vouch for.
 */
export const STORY_AUDIO_SOURCES = ["NONE", "LIBRARY", "UPLOAD"] as const;
export type StoryAudioSource = (typeof STORY_AUDIO_SOURCES)[number];

/**
 * What happens to the sound already on the video. `OVERLAY` keeps both tracks,
 * `REPLACE` mutes the original, `KEEP` ignores any added audio.
 */
export const STORY_ORIGINAL_AUDIO_MODES = ["KEEP", "MUTE", "OVERLAY"] as const;
export type StoryOriginalAudioMode = (typeof STORY_ORIGINAL_AUDIO_MODES)[number];

export const STORY_CAPTION_MAX_LENGTH = 180;

/**
 * Who may watch. `PATRONS` is HASUT's word for accepted connections — from
 * חסות, patronage — chosen deliberately instead of "follower", because the
 * relationship here is mutual and consented, not a one-way subscription.
 */
export const STORY_AUDIENCES = ["EVERYONE", "PATRONS"] as const;
export type StoryAudience = (typeof STORY_AUDIENCES)[number];

/** Video stays PENDING until a playlist exists. Images are READY immediately. */
export const STORY_PLAYBACK_STATUSES = ["PENDING", "READY"] as const;
export type StoryPlaybackStatus = (typeof STORY_PLAYBACK_STATUSES)[number];

/** A HASUT-cloud soundtrack a member can attach to a story. Admin curated. */
export interface AudioTrackView {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  audioUrl: string | null;
  /** Admin-set grouping such as "Calm" or "Festive". Never hardcoded in the UI. */
  mood: string;
  isActive: boolean;
}

export interface StoryAudioView {
  source: StoryAudioSource;
  trackId: string | null;
  title: string | null;
  url: string | null;
  /** Segment of the track to play, in seconds from the start of the track. */
  startSeconds: number;
  endSeconds: number | null;
}

export interface StoryView {
  id: string;
  memberId: string;
  kind: StoryKind;
  imageUrl: string | null;
  hlsUrl: string | null;
  previewHlsUrl: string | null;
  audioUrl: string | null;
  audio: StoryAudioView;
  caption: string;
  /** Resolved hex from the admin caption palette, not a free-form colour. */
  captionColor: string | null;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  originalAudioMode: StoryOriginalAudioMode;
  audience: StoryAudience;
  playbackStatus: StoryPlaybackStatus;
  expiresAt: string;
  moderationStatus: StoryModerationStatus;
  createdAt: string;
}

/** Watch or restore path. `live` is null when the member is not broadcasting. */
export interface LivePresenceView {
  live: LiveSessionView | null;
}

export interface LiveSessionView {
  id: string;
  memberId: string;
  title: string;
  audience: StoryAudience;
  status: LiveSessionStatus;
  hlsUrl: string | null;
  previewHlsUrl: string | null;
  ingestUrl: string | null;
  startedAt: string;
  endedAt: string | null;
}

/**
 * Composer rules the apps read at runtime. Caption palette, duration caps, and
 * audio limits are operator decisions, so they ship from configuration rather
 * than being frozen into the clients.
 */
export interface StoryComposerConfig {
  captionMaxLength: number;
  captionColors: string[];
  maxVideoDurationSeconds: number;
  maxAudioSegmentSeconds: number;
  audioLibraryEnabled: boolean;
  /** How many accepted connections the member has, to label the Patrons option. */
  patronCount: number;
  maxActiveStories: number;
  storyTtlHours: number;
}
