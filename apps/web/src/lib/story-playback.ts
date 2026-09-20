import type { StoryAudioSource, StoryKind, StoryOriginalAudioMode, StoryView } from "@hasut/types";

/**
 * `KEEP` means the added track is stored but not heard — the original sound
 * wins. Images have no original, so a chosen track always plays on a still.
 */
export function playsAddedAudio(
  kind: StoryKind,
  mode: StoryOriginalAudioMode,
  source: StoryAudioSource,
): boolean {
  if (source === "NONE") {
    return false;
  }
  if (kind === "IMAGE") {
    return true;
  }
  return mode !== "KEEP";
}

export function mutesOriginalAudio(kind: StoryKind, mode: StoryOriginalAudioMode): boolean {
  return kind === "VIDEO" && mode === "MUTE";
}

/** Loop the playhead inside a trim or audio window. */
export function loopWithin(seconds: number, start: number, end: number | null): number {
  if (seconds < start) {
    return start;
  }
  if (end !== null && seconds >= end) {
    return start;
  }
  return seconds;
}

export function storyAudioSrc(story: StoryView): string | null {
  if (!playsAddedAudio(story.kind, story.originalAudioMode, story.audio.source)) {
    return null;
  }
  return story.audio.url ?? story.audioUrl;
}
