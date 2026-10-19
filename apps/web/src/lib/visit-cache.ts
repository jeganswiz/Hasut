export interface VisitEntry<T> {
  data: T;
  updatedAt: number;
}

const visits = new Map<string, VisitEntry<unknown>>();

export const VISIT_KEYS = {
  map: "/",
  live: "/live",
  connections: "/connections",
  inbox: "/inbox",
  notifications: "/notifications",
  me: "/me",
} as const;

export function readVisit<T>(key: string): T | undefined {
  const entry = visits.get(key);
  return entry === undefined ? undefined : (entry.data as T);
}

export function writeVisit<T>(key: string, data: T): void {
  visits.set(key, { data, updatedAt: Date.now() });
}

export function clearVisit(key: string): void {
  visits.delete(key);
}

export function clearAllVisits(): void {
  visits.clear();
}
