export const PULL_REFRESH_THRESHOLD = 56;

export function prefersReducedMotion(media: { matches: boolean } | null): boolean {
  return media?.matches === true;
}

export function pullDistance(startY: number, currentY: number, atTop: boolean): number {
  if (!atTop) {
    return 0;
  }
  return Math.max(0, currentY - startY);
}

export function shouldTriggerRefresh(
  distance: number,
  atTop: boolean,
  threshold = PULL_REFRESH_THRESHOLD,
): boolean {
  return atTop && distance >= threshold;
}
