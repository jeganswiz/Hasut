import type { StoryCreateInput } from "@hasut/api-client";
import type { StoryAudience, StoryComposerConfig, StoryOriginalAudioMode } from "@hasut/types";
import { normalizeRange, type RangeValue } from "@hasut/utils";

export type ComposerTab = "activity" | "live";

export function pickCaptionColor(color: string, palette: readonly string[]): string | null {
  return palette.includes(color) ? color : null;
}

export function captionFits(caption: string, maxLength: number): boolean {
  return caption.trim().length <= maxLength;
}

export function liveTitleReady(title: string): boolean {
  return title.trim().length > 0;
}

export function patronAudienceHint(count: number): string {
  if (count === 0) {
    return "You have no accepted connections yet, so nobody would see this.";
  }
  return "Only the people you have accepted a connection with.";
}

export function composerBudgetHint(
  config: Pick<StoryComposerConfig, "maxActiveStories" | "storyTtlHours">,
): string {
  return `Up to ${config.maxActiveStories} active stories, each for ${config.storyTtlHours} hours.`;
}

export type StoryKindChoice = "IMAGE" | "VIDEO";

/** Expo ImagePicker reports video length in milliseconds. */
export function pickerDurationSeconds(durationMs: number): number {
  return Math.max(1, Math.round(durationMs / 1000));
}

export function videoTrimBounds(
  durationSeconds: number,
  maxVideoDurationSeconds: number,
): { duration: number; maxSpan: number; minSpan: number } {
  return {
    duration: durationSeconds,
    maxSpan: maxVideoDurationSeconds,
    minSpan: 1,
  };
}

export function initialVideoTrim(
  durationSeconds: number,
  maxVideoDurationSeconds: number,
): RangeValue {
  return normalizeRange(
    { start: 0, end: Math.min(durationSeconds, maxVideoDurationSeconds) },
    videoTrimBounds(durationSeconds, maxVideoDurationSeconds),
  );
}

export function overlayNeedsTrack(
  kind: StoryKindChoice,
  mode: StoryOriginalAudioMode,
  trackId: string | null,
): boolean {
  return kind === "VIDEO" && mode === "OVERLAY" && trackId === null;
}

export function imageStoryInput(input: {
  imageMediaId: string;
  caption: string;
  captionColor: string | null;
  audience: StoryAudience;
  trackId: string | null;
}): StoryCreateInput {
  return {
    kind: "IMAGE",
    imageMediaId: input.imageMediaId,
    caption: input.caption,
    captionColor: input.captionColor,
    audience: input.audience,
    originalAudioMode: "KEEP",
    audio:
      input.trackId === null
        ? undefined
        : { source: "LIBRARY", trackId: input.trackId, startSeconds: 0, endSeconds: null },
  };
}

export function videoStoryInput(input: {
  videoMediaId: string;
  caption: string;
  captionColor: string | null;
  audience: StoryAudience;
  trackId: string | null;
  originalAudioMode: StoryOriginalAudioMode;
  trim: RangeValue;
}): StoryCreateInput {
  return {
    kind: "VIDEO",
    videoMediaId: input.videoMediaId,
    caption: input.caption,
    captionColor: input.captionColor,
    audience: input.audience,
    originalAudioMode: input.originalAudioMode,
    trimStartSeconds: input.trim.start,
    trimEndSeconds: input.trim.end > input.trim.start ? input.trim.end : null,
    audio:
      input.trackId === null
        ? undefined
        : { source: "LIBRARY", trackId: input.trackId, startSeconds: 0, endSeconds: null },
  };
}
