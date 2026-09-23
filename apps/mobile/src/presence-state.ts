import type { LiveSessionView, StoryView } from "@hasut/types";
import {
  HLS_PLAYLIST_POLL_MS,
  isHlsDocument,
  resolveMediaUrl,
  storyAudioSrc,
  storyVisualState,
} from "@hasut/utils";

export { HLS_PLAYLIST_POLL_MS as LIVE_PLAYLIST_POLL_MS, isHlsDocument };

export type PresenceTab = "activity" | "live";

export function presenceEmpty(
  stories: readonly StoryView[],
  live: LiveSessionView | null,
): boolean {
  return stories.length === 0 && live === null;
}

export function initialPresenceTab(
  _stories: readonly StoryView[],
  live: LiveSessionView | null,
): PresenceTab {
  return live !== null ? "live" : "activity";
}

export function storyPlaybackUri(story: StoryView, apiOrigin: string): string | null {
  if (storyVisualState(story) !== "video") {
    return null;
  }
  return resolveMediaUrl(story.hlsUrl ?? story.previewHlsUrl, apiOrigin);
}

export function livePlaybackUri(live: LiveSessionView, apiOrigin: string): string | null {
  return resolveMediaUrl(live.hlsUrl ?? live.previewHlsUrl, apiOrigin);
}

export function storyAudioUri(story: StoryView, apiOrigin: string): string | null {
  return resolveMediaUrl(storyAudioSrc(story), apiOrigin);
}

export function storyStageCopy(story: StoryView, apiOrigin: string): string {
  const visual = storyVisualState(story);
  if (visual === "preparing") {
    return "Preparing playback";
  }
  if (
    visual === "video" &&
    resolveMediaUrl(story.hlsUrl ?? story.previewHlsUrl, apiOrigin) === null
  ) {
    return "Playback is ready on the map when a public playlist exists.";
  }
  return "";
}

export function liveStageCopy(live: LiveSessionView, apiOrigin: string): string {
  if (resolveMediaUrl(live.hlsUrl ?? live.previewHlsUrl, apiOrigin) === null) {
    return "Waiting for the live preview";
  }
  return live.audience === "PATRONS" ? "Visible to Patrons" : "Visible to everyone nearby";
}
