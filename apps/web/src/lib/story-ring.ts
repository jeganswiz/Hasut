export function hasStoryRing(kind: string | null | undefined): boolean {
  return kind === "IMAGE" || kind === "VIDEO" || kind === "LIVE";
}

/** What to draw around a profile. Live wins, then any unwatched story, then a fully watched story. */
export type ProfileRingState = "none" | "unseen" | "seen" | "live";

export function profileRingState(input: {
  live: boolean;
  storyIds: readonly string[];
  watchedStoryIds: readonly string[];
}): ProfileRingState {
  if (input.live) {
    return "live";
  }
  const storyIds = input.storyIds ?? [];
  if (storyIds.length === 0) {
    return "none";
  }
  const watched = new Set(input.watchedStoryIds);
  return storyIds.every((id) => watched.has(id)) ? "seen" : "unseen";
}

export function profileRingClass(state: ProfileRingState): string {
  if (state === "live") {
    return "is-live";
  }
  if (state === "unseen") {
    return "has-story is-unseen";
  }
  if (state === "seen") {
    return "has-story is-seen";
  }
  return "";
}

const WATCHED_KEY = "hasut.stories.watched";

/** Image stories have no playback clock. The watch ring uses the trim window, or one short sweep. */
export const IMAGE_STORY_WATCH_MS = 5_000;

export function storyWatchHoldMs(trimStartSeconds: number, trimEndSeconds: number | null): number {
  if (
    trimEndSeconds !== null &&
    Number.isFinite(trimEndSeconds) &&
    trimEndSeconds > trimStartSeconds
  ) {
    return Math.round((trimEndSeconds - trimStartSeconds) * 1000);
  }
  return IMAGE_STORY_WATCH_MS;
}

export function readWatchedStoryIds(storage: Pick<Storage, "getItem">): string[] {
  const raw = storage.getItem(WATCHED_KEY);
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function markStoryWatched(
  storage: Pick<Storage, "getItem" | "setItem">,
  memberId: string,
): string[] {
  const next = [...new Set([...readWatchedStoryIds(storage), memberId])];
  storage.setItem(WATCHED_KEY, JSON.stringify(next));
  return next;
}

export interface StoryTrayFace {
  memberId: string;
  label: string;
  imageUrl: string | null;
  kind: "LIVE" | "VIDEO" | "IMAGE" | null;
  storyIds: string[];
  self: boolean;
}

/** The signed-in member is always the first circle. Other faces are people with an active story. */
export function buildStoryTray(input: {
  selfId: string | null;
  selfLabel: string;
  selfImageUrl: string | null;
  selfKind: "LIVE" | "VIDEO" | "IMAGE" | null;
  selfStoryIds?: readonly string[];
  faces: Array<{
    memberId: string;
    label: string;
    imageUrl: string | null;
    kind: "LIVE" | "VIDEO" | "IMAGE";
    storyIds?: readonly string[];
  }>;
}): StoryTrayFace[] {
  const others = input.faces
    .filter((face) => face.memberId !== input.selfId)
    .map((face) => ({
      ...face,
      storyIds: [...(face.storyIds ?? [])],
      self: false as const,
    }));
  if (input.selfId === null) {
    return others;
  }
  return [
    {
      memberId: input.selfId,
      label: input.selfLabel,
      imageUrl: input.selfImageUrl,
      kind: input.selfKind,
      storyIds: [...(input.selfStoryIds ?? [])],
      self: true,
    },
    ...others,
  ];
}
