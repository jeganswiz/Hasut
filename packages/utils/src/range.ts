export interface RangeValue {
  start: number;
  end: number;
}

export interface RangeBounds {
  /** Total length of the source, in seconds. */
  duration: number;
  /** Longest selection the caller allows. */
  maxSpan: number;
  /** Shortest selection that still makes sense. */
  minSpan: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Moves one handle of a two-handle range and returns a selection that always
 * satisfies the bounds. Dragging a handle past its partner pushes the partner
 * rather than inverting the range, which is what makes the control feel solid.
 */
export function moveHandle(
  current: RangeValue,
  handle: "start" | "end",
  next: number,
  bounds: RangeBounds,
): RangeValue {
  const duration = Math.max(0, Math.round(bounds.duration));
  const minSpan = Math.max(1, Math.round(bounds.minSpan));
  const maxSpan = Math.max(minSpan, Math.round(bounds.maxSpan));
  const rounded = Math.round(next);

  if (duration <= minSpan) {
    return { start: 0, end: duration };
  }

  if (handle === "start") {
    const start = clamp(rounded, 0, duration - minSpan);
    const end = clamp(current.end, start + minSpan, Math.min(duration, start + maxSpan));
    return { start, end };
  }

  const end = clamp(rounded, minSpan, duration);
  const start = clamp(current.start, Math.max(0, end - maxSpan), end - minSpan);
  return { start, end };
}

/** Fits an arbitrary selection inside the bounds, used when a source loads. */
export function normalizeRange(value: RangeValue, bounds: RangeBounds): RangeValue {
  return moveHandle(moveHandle(value, "start", value.start, bounds), "end", value.end, bounds);
}

/** `0:07` style label. Stories are short, so hours never appear. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
