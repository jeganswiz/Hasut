export const SHEET_SNAPS = {
  peek: 0.22,
  half: 0.48,
  expanded: 0.82,
} as const;

export type SheetSnap = keyof typeof SHEET_SNAPS;

const ORDER: SheetSnap[] = ["peek", "half", "expanded"];

export function sheetHeight(snap: SheetSnap, viewportHeight: number): number {
  const safe = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  return Math.round(safe * SHEET_SNAPS[snap]);
}

export function nearestSheetSnap(height: number, viewportHeight: number): SheetSnap {
  const safeViewport = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 1;
  const ratio = height / safeViewport;
  let best: SheetSnap = "half";
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const snap of ORDER) {
    const delta = Math.abs(ratio - SHEET_SNAPS[snap]);
    if (delta < bestDelta) {
      best = snap;
      bestDelta = delta;
    }
  }
  return best;
}

export function snapAfterDrag(start: SheetSnap, dy: number, threshold = 36): SheetSnap {
  const index = ORDER.indexOf(start);
  if (dy <= -threshold) {
    return ORDER[Math.min(ORDER.length - 1, index + 1)] ?? start;
  }
  if (dy >= threshold) {
    return ORDER[Math.max(0, index - 1)] ?? start;
  }
  return start;
}

export const COMPACT_DISCOVERY_MAX = 859;

export function isCompactDiscovery(width: number): boolean {
  return width <= COMPACT_DISCOVERY_MAX;
}
