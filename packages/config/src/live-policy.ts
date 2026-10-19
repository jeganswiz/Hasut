/**
 * Operator-owned rules for live broadcasts. Components read these at runtime;
 * nothing here is frozen into a client.
 */
export interface LivePolicy {
  /** How often the host browser confirms it is still broadcasting. */
  heartbeatSeconds: number;
  /** A LIVE session with no heartbeat for this long is ended automatically. */
  idleTimeoutSeconds: number;
  titleMaxLength: number;
  descriptionMaxLength: number;
  /** Live categories a host can pick. Operators curate the list. */
  categories: string[];
  chatMaxChars: number;
  chatMessagesPerMinute: number;
  reactionsPerMinute: number;
  /** Words hidden from every live chat. Hosts can add their own per session. */
  blockedWords: string[];
  /** Most members a PRIVATE live can invite. */
  maxInvitees: number;
  /** Most moderators one host can name. */
  maxModerators: number;
  /** Replays are kept this long before they expire like other stories. */
  replayRetentionDays: number;
  /** Reminder notifications go out this long before a scheduled live. */
  scheduleReminderMinutes: number;
  maxScheduleDaysAhead: number;
  /** Seconds between viewer playlist readiness checks. */
  playlistPollSeconds: number;
}

export const LIVE_POLICY_CONFIG_KEY = "live.policy";

export const LIVE_POLICY_DEFAULTS: LivePolicy = {
  heartbeatSeconds: 20,
  idleTimeoutSeconds: 90,
  titleMaxLength: 80,
  descriptionMaxLength: 500,
  categories: [
    "Workshop",
    "Tutorial",
    "Q&A",
    "Behind the scenes",
    "Shop floor",
    "Market",
    "Community",
    "Other",
  ],
  chatMaxChars: 300,
  chatMessagesPerMinute: 20,
  reactionsPerMinute: 60,
  blockedWords: [],
  maxInvitees: 50,
  maxModerators: 10,
  replayRetentionDays: 30,
  scheduleReminderMinutes: 15,
  maxScheduleDaysAhead: 30,
  playlistPollSeconds: 2,
};

const NUMBER_KEYS = [
  "heartbeatSeconds",
  "idleTimeoutSeconds",
  "titleMaxLength",
  "descriptionMaxLength",
  "chatMaxChars",
  "chatMessagesPerMinute",
  "reactionsPerMinute",
  "maxInvitees",
  "maxModerators",
  "replayRetentionDays",
  "scheduleReminderMinutes",
  "maxScheduleDaysAhead",
  "playlistPollSeconds",
] as const satisfies ReadonlyArray<keyof LivePolicy>;

const LIST_KEYS = ["categories", "blockedWords"] as const satisfies ReadonlyArray<keyof LivePolicy>;

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isLivePolicy(value: unknown): value is LivePolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    NUMBER_KEYS.every((key) => isPositiveNumber(record[key])) &&
    LIST_KEYS.every((key) => isStringList(record[key])) &&
    (record.categories as string[]).length > 0
  );
}

/** Fills any cap an older stored policy does not have, keeping operator values. */
export function readLivePolicy(value: unknown): LivePolicy {
  const merged: LivePolicy = {
    ...LIVE_POLICY_DEFAULTS,
    categories: [...LIVE_POLICY_DEFAULTS.categories],
    blockedWords: [...LIVE_POLICY_DEFAULTS.blockedWords],
  };
  if (typeof value !== "object" || value === null) {
    return merged;
  }
  const record = value as Record<string, unknown>;
  for (const key of NUMBER_KEYS) {
    const next = record[key];
    if (isPositiveNumber(next)) {
      merged[key] = next;
    }
  }
  const categories = record.categories;
  if (isStringList(categories) && categories.length > 0) {
    merged.categories = categories.map((item) => item.trim()).filter((item) => item.length > 0);
  }
  const blockedWords = record.blockedWords;
  if (isStringList(blockedWords)) {
    merged.blockedWords = normalizeBlockedWords(blockedWords);
  }
  return merged;
}

/** Lower-cases and trims so matching is one comparison per word. */
export function normalizeBlockedWords(words: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const word of words) {
    const clean = word.trim().toLowerCase();
    if (clean.length > 0) {
      seen.add(clean);
    }
  }
  return [...seen];
}

/** True when `text` contains any blocked word as a whole word, case-insensitive. */
export function containsBlockedWord(text: string, blockedWords: readonly string[]): boolean {
  if (blockedWords.length === 0) {
    return false;
  }
  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const blocked = new Set(blockedWords.map((word) => word.toLowerCase()));
  return tokens.some((token) => token.length > 0 && blocked.has(token));
}
