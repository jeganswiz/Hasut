import type { DiscoveryCard, DiscoveryKind } from "@hasut/types";

/** People, professionals, and businesses start selected on the discovery strip. */
export const DEFAULT_DISCOVERY_KINDS: DiscoveryKind[] = ["PROFESSIONAL", "BUSINESS", "MEMBER"];

export const CHROME_HEIGHT_MAX = 72;
export const CHROME_HEIGHT_MIN = 56;

export interface ChromeScrollState {
  height: number;
  solid: boolean;
  progress: number;
}

/**
 * Navbar tracks scroll over the map block.
 * Height eases from full to compact across the first half of the map.
 * The bar turns solid once that halfway point has passed.
 */
export function chromeScrollState(scrollY: number, mapHeight: number): ChromeScrollState {
  const safeScroll = Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0;
  const travel = mapHeight > 0 ? mapHeight / 2 : 96;
  const progress = Math.min(1, safeScroll / travel);
  const solid = mapHeight > 0 ? safeScroll >= mapHeight / 2 : safeScroll >= 40;
  const height = Math.round(CHROME_HEIGHT_MAX - (CHROME_HEIGHT_MAX - CHROME_HEIGHT_MIN) * progress);
  return { height, solid, progress };
}

export type SuggestionGroup = "Service" | "Professionals" | "Businesses" | "People";

export type SearchSuggestion =
  | {
      key: string;
      group: "Service";
      label: string;
      detail: string;
      categoryId: string;
    }
  | {
      key: string;
      group: Exclude<SuggestionGroup, "Service">;
      label: string;
      detail: string;
      itemId: string;
      kind: DiscoveryKind;
    };

const GROUP_ORDER: SuggestionGroup[] = ["Service", "Professionals", "Businesses", "People"];

export function kindGroup(kind: DiscoveryKind): Exclude<SuggestionGroup, "Service"> {
  if (kind === "MEMBER") {
    return "People";
  }
  if (kind === "PROFESSIONAL") {
    return "Professionals";
  }
  return "Businesses";
}

export function buildSearchSuggestions(input: {
  query: string;
  items: DiscoveryCard[];
  categories: Array<{ id: string; name: string }>;
  limit?: number;
  /** Items already returned by search for this query. Keep service-label matches the card text does not repeat. */
  prefiltered?: boolean;
}): SearchSuggestion[] {
  const q = input.query.trim().toLowerCase();
  if (q.length === 0) {
    return [];
  }
  const limit = input.limit ?? 8;
  const matches: SearchSuggestion[] = [];
  for (const category of input.categories) {
    if (!category.name.toLowerCase().includes(q)) {
      continue;
    }
    matches.push({
      key: `service:${category.id}`,
      group: "Service",
      label: category.name,
      detail: "Service",
      categoryId: category.id,
    });
  }
  for (const item of input.items) {
    const haystack = `${item.title} ${item.subtitle} ${item.categoryLabel ?? ""}`.toLowerCase();
    if (input.prefiltered !== true && !haystack.includes(q)) {
      continue;
    }
    matches.push({
      key: `${item.kind}:${item.id}`,
      group: kindGroup(item.kind),
      label: item.title,
      detail: item.categoryLabel ?? item.subtitle,
      itemId: item.id,
      kind: item.kind,
    });
  }
  matches.sort((left, right) => GROUP_ORDER.indexOf(left.group) - GROUP_ORDER.indexOf(right.group));
  return matches.slice(0, limit);
}

export function isDiscoveryAlert(
  load: "loading" | "empty" | "error" | "success",
  message: string,
): boolean {
  if (/seeded demo neighborhood/i.test(message)) {
    return true;
  }
  return (load === "empty" || load === "error") && message.trim().length > 0;
}

export interface ToastNote {
  id: number;
  text: string;
}

export function nextToasts(current: ToastNote[], text: string, id: number): ToastNote[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return current;
  }
  return [...current.filter((item) => item.text !== trimmed), { id, text: trimmed }].slice(-3);
}
