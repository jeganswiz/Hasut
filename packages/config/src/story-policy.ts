export interface StoryPolicy {
  captionMaxLength: number;
  /** Caption palette. Operators curate it; components never hardcode swatches. */
  captionColors: string[];
  maxVideoDurationSeconds: number;
  /** Longest slice of a soundtrack a member may attach. */
  maxAudioSegmentSeconds: number;
  audioLibraryEnabled: boolean;
  /** How long a published story stays on the map. */
  storyTtlHours: number;
  /** Active, unexpired stories one member may have at once. */
  maxActiveStories: number;
  maxStoriesPerHour: number;
  maxLiveStartsPerHour: number;
  /** A live session with no owner heartbeat for this long is ended automatically. */
  liveIdleTimeoutSeconds: number;
}

export const STORY_POLICY_CONFIG_KEY = "story.policy";

/** Seed / fallback values owned by configuration, not by the composer. */
export const STORY_POLICY_DEFAULTS: StoryPolicy = {
  captionMaxLength: 180,
  captionColors: [
    "#FFFFFF",
    "#0F172A",
    "#6D28D9",
    "#EAB308",
    "#DC2626",
    "#15803D",
    "#0EA5E9",
    "#DB2777",
  ],
  maxVideoDurationSeconds: 60,
  maxAudioSegmentSeconds: 30,
  audioLibraryEnabled: true,
  storyTtlHours: 24,
  maxActiveStories: 5,
  maxStoriesPerHour: 10,
  maxLiveStartsPerHour: 8,
  liveIdleTimeoutSeconds: 90,
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isStoryPolicy(value: unknown): value is StoryPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const numbers: Array<keyof StoryPolicy> = [
    "captionMaxLength",
    "maxVideoDurationSeconds",
    "maxAudioSegmentSeconds",
    "storyTtlHours",
    "maxActiveStories",
    "maxStoriesPerHour",
    "maxLiveStartsPerHour",
    "liveIdleTimeoutSeconds",
  ];
  if (
    !numbers.every(
      (key) => typeof record[key] === "number" && Number.isFinite(record[key]) && record[key] > 0,
    )
  ) {
    return false;
  }
  if (typeof record.audioLibraryEnabled !== "boolean") {
    return false;
  }
  const colors = record.captionColors;
  return (
    Array.isArray(colors) &&
    colors.length > 0 &&
    colors.every((color) => typeof color === "string" && HEX_COLOR.test(color))
  );
}

const NUMBER_KEYS: Array<keyof StoryPolicy> = [
  "captionMaxLength",
  "maxVideoDurationSeconds",
  "maxAudioSegmentSeconds",
  "storyTtlHours",
  "maxActiveStories",
  "maxStoriesPerHour",
  "maxLiveStartsPerHour",
];

/**
 * Fills caps that an older stored policy does not have yet, so adding a limit
 * does not throw away an operator's palette.
 */
export function readStoryPolicy(value: unknown): StoryPolicy {
  if (typeof value !== "object" || value === null) {
    return { ...STORY_POLICY_DEFAULTS, captionColors: [...STORY_POLICY_DEFAULTS.captionColors] };
  }
  const record = value as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...STORY_POLICY_DEFAULTS,
    captionColors: [...STORY_POLICY_DEFAULTS.captionColors],
  };
  for (const key of NUMBER_KEYS) {
    const next = record[key];
    if (typeof next === "number" && Number.isFinite(next) && next > 0) {
      merged[key] = next;
    }
  }
  if (typeof record.audioLibraryEnabled === "boolean") {
    merged.audioLibraryEnabled = record.audioLibraryEnabled;
  }
  const colors = record.captionColors;
  if (
    Array.isArray(colors) &&
    colors.length > 0 &&
    colors.every((color) => typeof color === "string" && HEX_COLOR.test(color))
  ) {
    merged.captionColors = colors;
  }
  return isStoryPolicy(merged)
    ? merged
    : { ...STORY_POLICY_DEFAULTS, captionColors: [...STORY_POLICY_DEFAULTS.captionColors] };
}
