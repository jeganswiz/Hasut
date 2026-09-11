import { snapToGrid } from "./geo";
import { shouldAcceptLocationFix, shouldRefreshNearby } from "./presence-gate";

describe("shouldAcceptLocationFix", () => {
  const origin = { latitude: 13.0418, longitude: 80.2341 };
  const far = { latitude: 13.05, longitude: 80.24 };

  it("accepts the first fix", () => {
    expect(
      shouldAcceptLocationFix({
        previous: null,
        next: origin,
        lastAcceptedAtMs: null,
        nowMs: 1_000,
        significantMoveMeters: 400,
        minUpdateIntervalSeconds: 120,
      }),
    ).toBe(true);
  });

  it("ignores GPS noise below the significant-move threshold", () => {
    expect(
      shouldAcceptLocationFix({
        previous: origin,
        next: { latitude: 13.04181, longitude: 80.23411 },
        lastAcceptedAtMs: 0,
        nowMs: 180_000,
        significantMoveMeters: 400,
        minUpdateIntervalSeconds: 120,
      }),
    ).toBe(false);
  });

  it("waits for the configured interval even after a real move", () => {
    expect(
      shouldAcceptLocationFix({
        previous: origin,
        next: far,
        lastAcceptedAtMs: 0,
        nowMs: 30_000,
        significantMoveMeters: 400,
        minUpdateIntervalSeconds: 120,
      }),
    ).toBe(false);
    expect(
      shouldAcceptLocationFix({
        previous: origin,
        next: far,
        lastAcceptedAtMs: 0,
        nowMs: 120_000,
        significantMoveMeters: 400,
        minUpdateIntervalSeconds: 120,
      }),
    ).toBe(true);
  });
});

describe("shouldRefreshNearby", () => {
  const origin = { latitude: 13.0418, longitude: 80.2341 };

  it("refreshes when filters change even if the origin cell is unchanged", () => {
    const cellId = "already";
    expect(
      shouldRefreshNearby({
        previousCellId: cellId,
        next: origin,
        cellSizeMeters: 400,
        lastNearbyAtMs: 1,
        nowMs: 2,
        nearbyTtlSeconds: 120,
        filtersChanged: true,
      }),
    ).toBe(true);
  });

  it("stays quiet until the nearby TTL when standing still", () => {
    const cellId = snapToGrid(origin, 400).cellId;
    expect(
      shouldRefreshNearby({
        previousCellId: cellId,
        next: origin,
        cellSizeMeters: 400,
        lastNearbyAtMs: 0,
        nowMs: 10_000,
        nearbyTtlSeconds: 120,
        filtersChanged: false,
      }),
    ).toBe(false);
  });
});
