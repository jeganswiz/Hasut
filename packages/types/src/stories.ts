export const STORY_KINDS = ["IMAGE", "VIDEO", "LIVE"] as const;
export type StoryKind = (typeof STORY_KINDS)[number];

export const STORY_MODERATION_STATUSES = ["ACTIVE", "HIDDEN"] as const;
export type StoryModerationStatus = (typeof STORY_MODERATION_STATUSES)[number];

export const LIVE_SESSION_STATUSES = ["LIVE", "ENDED"] as const;
export type LiveSessionStatus = (typeof LIVE_SESSION_STATUSES)[number];

export interface StoryView {
  id: string;
  memberId: string;
  kind: StoryKind;
  imageUrl: string | null;
  hlsUrl: string | null;
  previewHlsUrl: string | null;
  audioUrl: string | null;
  expiresAt: string;
  moderationStatus: StoryModerationStatus;
  createdAt: string;
}

export interface LiveSessionView {
  id: string;
  memberId: string;
  status: LiveSessionStatus;
  hlsUrl: string | null;
  previewHlsUrl: string | null;
  ingestUrl: string | null;
  startedAt: string;
  endedAt: string | null;
}
