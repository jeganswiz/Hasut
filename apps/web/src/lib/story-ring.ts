export function hasStoryRing(kind: string | null | undefined): boolean {
  return kind === "IMAGE" || kind === "VIDEO" || kind === "LIVE";
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
  self: boolean;
}

/** The signed-in member is always the first circle. Other faces are people with an active story. */
export function buildStoryTray(input: {
  selfId: string | null;
  selfLabel: string;
  selfImageUrl: string | null;
  selfKind: "LIVE" | "VIDEO" | "IMAGE" | null;
  faces: Array<{
    memberId: string;
    label: string;
    imageUrl: string | null;
    kind: "LIVE" | "VIDEO" | "IMAGE";
  }>;
}): StoryTrayFace[] {
  const others = input.faces
    .filter((face) => face.memberId !== input.selfId)
    .map((face) => ({ ...face, self: false as const }));
  if (input.selfId === null) {
    return others;
  }
  return [
    {
      memberId: input.selfId,
      label: input.selfLabel,
      imageUrl: input.selfImageUrl,
      kind: input.selfKind,
      self: true,
    },
    ...others,
  ];
}
