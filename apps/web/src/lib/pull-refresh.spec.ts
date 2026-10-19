import {
  PULL_REFRESH_THRESHOLD,
  prefersReducedMotion,
  pullDistance,
  shouldTriggerRefresh,
} from "./pull-refresh";

describe("pull to refresh", () => {
  it("only counts a downward pull when the scroller is at the top", () => {
    expect(pullDistance(40, 120, true)).toBe(80);
    expect(pullDistance(40, 120, false)).toBe(0);
  });

  it("triggers a replace once the pull crosses the threshold", () => {
    expect(shouldTriggerRefresh(PULL_REFRESH_THRESHOLD, true)).toBe(true);
    expect(shouldTriggerRefresh(PULL_REFRESH_THRESHOLD - 1, true)).toBe(false);
    expect(shouldTriggerRefresh(120, false)).toBe(false);
  });

  it("stays disabled when reduced motion is preferred", () => {
    expect(prefersReducedMotion({ matches: true })).toBe(true);
    expect(prefersReducedMotion({ matches: false })).toBe(false);
  });
});
