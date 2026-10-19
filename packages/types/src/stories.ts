export const STORY_KINDS = ["IMAGE", "VIDEO", "LIVE"] as const;
export type StoryKind = (typeof STORY_KINDS)[number];

export const STORY_MODERATION_STATUSES = ["ACTIVE", "HIDDEN"] as const;
export type StoryModerationStatus = (typeof STORY_MODERATION_STATUSES)[number];

export const LIVE_SESSION_STATUSES = ["SCHEDULED", "LIVE", "ENDED"] as const;
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

/** Hours a member can keep one story on the map. The policy cap can hide the longer choices. */
export const STORY_TTL_HOUR_OPTIONS = [4, 8, 12, 24] as const;
export type StoryTtlHours = (typeof STORY_TTL_HOUR_OPTIONS)[number];

/**
 * Who may watch. `PATRONS` is HASUT's word for accepted connections — from
 * חסות, patronage — chosen deliberately instead of "follower", because the
 * relationship here is mutual and consented, not a one-way subscription.
 */
export const STORY_AUDIENCES = ["EVERYONE", "PATRONS", "PRIVATE"] as const;
export type StoryAudience = (typeof STORY_AUDIENCES)[number];

/** Audiences a photo or video story can pick. PRIVATE is for lives and replays. */
export const STORY_COMPOSER_AUDIENCES = ["EVERYONE", "PATRONS"] as const;
export type StoryComposerAudience = (typeof STORY_COMPOSER_AUDIENCES)[number];

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

/** Someone who opened a story. `liked` is the heart on the owner's viewer list. */
export interface StoryViewerEntry {
  member: {
    id: string;
    displayName: string;
    photoUrl: string | null;
  };
  liked: boolean;
  viewedAt: string;
}

export interface StoryViewerList {
  viewers: StoryViewerEntry[];
}

export type StoryCaptionBackdrop = "none" | "solid" | "gradient";

/** Centre of the caption on the frame, plus the look painted with it. */
export interface StoryCaptionLayout {
  x: number;
  y: number;
  styleIndex: number;
  backdrop: StoryCaptionBackdrop;
  opacity: number;
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
  /**
   * Where the caption sits on the 9:16 frame, as percentages.
   * Null on stories published before placement was stored.
   */
  captionX: number | null;
  captionY: number | null;
  captionW: number | null;
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

export const LIVE_RECORDING_STATUSES = [
  "NONE",
  "RECORDING",
  "PROCESSING",
  "READY",
  "FAILED",
  "DISCARDED",
] as const;
export type LiveRecordingStatus = (typeof LIVE_RECORDING_STATUSES)[number];

export const LIVE_END_REASONS = ["HOST", "MODERATOR", "IDLE_TIMEOUT"] as const;
export type LiveEndReason = (typeof LIVE_END_REASONS)[number];

/**
 * Server view of the broadcast pipe. `UNKNOWN` means the media server cannot
 * be asked; `WAITING` means no media has arrived yet.
 */
export const LIVE_HEALTH_STATES = ["UNKNOWN", "WAITING", "HEALTHY", "DEGRADED", "OFFLINE"] as const;
export type LiveHealthState = (typeof LIVE_HEALTH_STATES)[number];

export interface LiveHostPreview {
  id: string;
  displayName: string;
  photoUrl: string | null;
}

export interface LiveSessionView {
  id: string;
  memberId: string;
  host: LiveHostPreview;
  title: string;
  description: string;
  category: string | null;
  thumbnailUrl: string | null;
  audience: StoryAudience;
  status: LiveSessionStatus;
  scheduledFor: string | null;
  hlsUrl: string | null;
  previewHlsUrl: string | null;
  /** Only the owner receives this. */
  ingestUrl: string | null;
  chatEnabled: boolean;
  chatPatronsOnly: boolean;
  slowModeSeconds: number;
  /** Host-added words. Only the owner and moderators receive the list. */
  blockedWords: string[];
  recordingEnabled: boolean;
  recordingStatus: LiveRecordingStatus;
  replayStoryId: string | null;
  viewerCount: number;
  peakViewers: number;
  totalViews: number;
  reactionCount: number;
  messageCount: number;
  endedReason: LiveEndReason | null;
  startedAt: string;
  endedAt: string | null;
}

/** Settings a host may change before or during a broadcast. */
export interface LiveSettingsInput {
  title?: string;
  description?: string;
  category?: string | null;
  thumbnailMediaId?: string | null;
  chatEnabled?: boolean;
  chatPatronsOnly?: boolean;
  slowModeSeconds?: number;
  blockedWords?: string[];
}

export interface LiveStartInput extends LiveSettingsInput {
  audience?: StoryAudience;
  /** Members allowed into a PRIVATE live. Ignored for other audiences. */
  inviteeIds?: string[];
  recordingEnabled?: boolean;
  /** Start a previously scheduled session instead of creating a new one. */
  scheduledId?: string;
}

export interface LiveScheduleInput extends LiveSettingsInput {
  audience?: StoryAudience;
  inviteeIds?: string[];
  recordingEnabled?: boolean;
  scheduledFor: string;
}

export interface LiveHealthView {
  state: LiveHealthState;
  /** True once the media server reports a readable stream. */
  streamReady: boolean;
  tracks: string[];
  bitrateKbps: number | null;
  viewerCount: number;
  lastHeartbeatAt: string | null;
  checkedAt: string;
}

export interface LiveHeartbeatResult {
  live: LiveSessionView;
  health: LiveHealthView;
}

export interface LiveSummaryView {
  live: LiveSessionView;
  durationSeconds: number;
  peakViewers: number;
  totalViews: number;
  reactionCount: number;
  messageCount: number;
  endedReason: LiveEndReason | null;
}

/** Rules the host studio reads at runtime. Operators own the values. */
export interface LiveComposerConfig {
  titleMaxLength: number;
  descriptionMaxLength: number;
  categories: string[];
  heartbeatSeconds: number;
  chatMaxChars: number;
  maxInvitees: number;
  maxModerators: number;
  maxScheduleDaysAhead: number;
  /** False hides the recording toggle instead of showing a switch that does nothing. */
  recordingAvailable: boolean;
  replayRetentionDays: number;
  patronCount: number;
  playlistPollSeconds: number;
}

export interface LiveModeratorList {
  moderators: LiveHostPreview[];
}

export const LIVE_REALTIME_NAMESPACE = "/ws/v1/live";

export const LIVE_CARD_STATUSES = ["LIVE", "UPCOMING", "REPLAY"] as const;
export type LiveCardStatus = (typeof LIVE_CARD_STATUSES)[number];

export interface LiveCardView {
  id: string;
  host: LiveHostPreview;
  title: string;
  category: string | null;
  thumbnailUrl: string | null;
  previewHlsUrl: string | null;
  audience: StoryAudience;
  status: LiveCardStatus;
  viewerCount: number;
  scheduledFor: string | null;
  distanceBucket: string | null;
  href: string;
}

export interface LiveDiscoverResult {
  liveNow: LiveCardView[];
  patrons: LiveCardView[];
  upcoming: LiveCardView[];
  recommended: LiveCardView[];
  recentReplays: LiveCardView[];
}

export const LIVE_REPLAY_VISIBILITIES = ["EVERYONE", "PATRONS", "PRIVATE", "DISCARD"] as const;
export type LiveReplayVisibility = (typeof LIVE_REPLAY_VISIBILITIES)[number];

export interface LiveReplayInput {
  title?: string;
  description?: string;
  thumbnailMediaId?: string | null;
  visibility?: LiveReplayVisibility;
}

export interface LiveReplayStatus {
  liveId: string;
  recordingStatus: LiveRecordingStatus;
  replayStoryId: string | null;
  replayHlsUrl: string | null;
}

export interface LiveReminderState {
  creatorId: string;
  reminded: boolean;
}

export interface LiveMetricInput {
  startupMs?: number;
  fatalErrors?: number;
  reconnects?: number;
  droppedFrames?: number;
}

export interface LiveMetricsSummary {
  samples: number;
  avgStartupMs: number | null;
  fatalErrors: number;
  reconnects: number;
  droppedFrames: number;
}

export interface LiveChatMessageView {
  id: string;
  liveId: string;
  member: LiveHostPreview;
  body: string;
  pinned: boolean;
  isHost: boolean;
  isPatron: boolean;
  isModerator: boolean;
  createdAt: string;
}

export interface LiveChatPage {
  messages: LiveChatMessageView[];
  nextCursor: string | null;
  pinned: LiveChatMessageView | null;
}

export interface LiveViewersUpdated {
  liveId: string;
  viewerCount: number;
}

export interface LiveReactionEvent {
  liveId: string;
  emoji: string;
}

export interface LiveEndedEvent {
  liveId: string;
  endedReason: LiveEndReason;
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
