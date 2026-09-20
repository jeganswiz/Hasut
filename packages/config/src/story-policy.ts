export interface StoryPolicy {
  captionMaxLength: number;
  /** Caption palette. Operators curate it; components never hardcode swatches. */
  captionColors: string[];
  maxVideoDurationSeconds: number;
  /** Longest slice of a soundtrack a member may attach. */
  maxAudioSegmentSeconds: number;
  audioLibraryEnabled: boolean;
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
  ];
  if (!numbers.every((key) => typeof record[key] === "number" && Number.isFinite(record[key]))) {
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
