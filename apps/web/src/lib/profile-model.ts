import type { ConnectionDirection, ConnectionStatus } from "@hasut/types";

export interface ConnectionStatInput {
  status: ConnectionStatus | string;
  direction: ConnectionDirection | string;
}

/** Accepted connections are patrons. Incoming pending connections are requests. */
export function connectionStats(connections: readonly ConnectionStatInput[]): {
  patrons: number;
  requests: number;
} {
  let patrons = 0;
  let requests = 0;
  for (const item of connections) {
    if (item.status === "ACCEPTED") {
      patrons += 1;
    }
    if (item.status === "PENDING" && item.direction === "INCOMING") {
      requests += 1;
    }
  }
  return { patrons, requests };
}

/** `New` until at least one review exists. A zero average is not a rating. */
export function ratingLabel(rating: number | null, count: number): string {
  if (rating === null || count <= 0 || !Number.isFinite(rating)) {
    return "New";
  }
  return rating.toFixed(1);
}

export function compactCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0";
  }
  const rounded = Math.round(value);
  if (rounded < 1000) {
    return String(rounded);
  }
  if (rounded < 1_000_000) {
    const scaled = rounded / 1000;
    const text = scaled >= 10 ? String(Math.round(scaled)) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${text}K`;
  }
  const scaled = rounded / 1_000_000;
  return `${scaled.toFixed(1).replace(/\.0$/, "")}M`;
}

export function relativeTime(iso: string, nowMs: number): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) {
    return "";
  }
  const delta = Math.max(0, nowMs - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  if (delta < minute) {
    return "Just now";
  }
  if (delta < hour) {
    return `${Math.floor(delta / minute)}m ago`;
  }
  if (delta < day) {
    return `${Math.floor(delta / hour)}h ago`;
  }
  if (delta < week) {
    return `${Math.floor(delta / day)}d ago`;
  }
  if (delta < 30 * day) {
    return `${Math.floor(delta / week)}w ago`;
  }
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function trimmedDurationSeconds(start: number, end: number | null): number | null {
  if (end === null || !Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  const seconds = Math.round(end - start);
  return seconds > 0 ? seconds : null;
}

export function storyEngagement(viewers: readonly { liked: boolean }[]): {
  views: number;
  likes: number;
} {
  let likes = 0;
  for (const viewer of viewers) {
    if (viewer.liked) {
      likes += 1;
    }
  }
  return { views: viewers.length, likes };
}

export type PresenceSort = "latest" | "oldest";

export function sortByCreatedAt<T extends { createdAt: string }>(
  items: readonly T[],
  order: PresenceSort,
): T[] {
  return [...items].sort((left, right) => {
    const delta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return order === "oldest" ? delta : -delta;
  });
}

/**
 * Rank signals the services API does not carry yet.
 * `used` is booking/use history. `reviewCount` and `rating` are per offering.
 * Missing signals sort after real ones and otherwise keep the original order.
 * Active listings stay ahead of paused ones inside the same tier.
 */
export interface RankableOffering {
  id: string;
  used: boolean;
  reviewCount: number | null;
  rating: number | null;
  active: boolean;
}

export function rankOfferings<T extends RankableOffering>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (left.item.used !== right.item.used) {
        return left.item.used ? -1 : 1;
      }
      const leftReviews = left.item.reviewCount ?? -1;
      const rightReviews = right.item.reviewCount ?? -1;
      if (leftReviews !== rightReviews) {
        return rightReviews - leftReviews;
      }
      const leftRating = left.item.rating ?? -1;
      const rightRating = right.item.rating ?? -1;
      if (leftRating !== rightRating) {
        return rightRating - leftRating;
      }
      if (left.item.active !== right.item.active) {
        return left.item.active ? -1 : 1;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.item);
}

export interface OfferingGroups<T> {
  used: T[];
  reviewed: T[];
  rest: T[];
}

export function groupOfferings<T extends RankableOffering>(items: readonly T[]): OfferingGroups<T> {
  const ranked = rankOfferings(items);
  return {
    used: ranked.filter((item) => item.used),
    reviewed: ranked.filter((item) => !item.used && (item.reviewCount ?? 0) > 0),
    rest: ranked.filter((item) => !item.used && (item.reviewCount ?? 0) <= 0),
  };
}

export type ServiceTabState = "upgrade" | "finish" | "empty" | "list";

export function serviceTabState(input: {
  onboardingStatus: string | null;
  offeringCount: number;
}): ServiceTabState {
  if (input.onboardingStatus === null || input.onboardingStatus === "NOT_STARTED") {
    return "upgrade";
  }
  if (input.offeringCount > 0) {
    return "list";
  }
  if (input.onboardingStatus === "DRAFT") {
    return "finish";
  }
  return "empty";
}

export function formatOfferingPrice(amount: number | null, currency: string | null): string | null {
  if (amount === null || !Number.isFinite(amount)) {
    return null;
  }
  if (currency !== null && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }
  return String(amount);
}

export interface ProfileLiveCard {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  startedAt: string;
  durationSeconds: number | null;
}

/**
 * `GET /me/live` returns the current broadcast only. While that session is
 * live, this grid stays empty so an active stream is not presented as a
 * recording. Live-kind stories that remain after the session ends are the
 * recordings the member API can show today.
 */
export function recordedLiveCards(
  stories: readonly {
    id: string;
    kind: string;
    caption: string;
    imageUrl: string | null;
    createdAt: string;
    trimStartSeconds: number;
    trimEndSeconds: number | null;
  }[],
  activeLive: { status: string } | null,
): ProfileLiveCard[] {
  if (activeLive?.status === "LIVE") {
    return [];
  }
  return stories
    .filter((story) => story.kind === "LIVE")
    .map((story) => ({
      id: story.id,
      title: story.caption.trim().length > 0 ? story.caption : "Live",
      thumbnailUrl: story.imageUrl,
      startedAt: story.createdAt,
      durationSeconds: trimmedDurationSeconds(story.trimStartSeconds, story.trimEndSeconds),
    }));
}

export type ShareResult = "shared" | "copied" | "cancelled";

export async function shareOrCopy(input: {
  url: string;
  title: string;
  share?: (data: { title: string; url: string }) => Promise<void>;
  writeText: (value: string) => Promise<void>;
}): Promise<ShareResult> {
  if (input.share !== undefined) {
    try {
      await input.share({ title: input.title, url: input.url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  await input.writeText(input.url);
  return "copied";
}
