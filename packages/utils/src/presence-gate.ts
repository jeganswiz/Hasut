import { haversineMeters, snapToGrid, type GeoPoint } from "./geo";

export function shouldAcceptLocationFix(input: {
  previous: GeoPoint | null;
  next: GeoPoint;
  lastAcceptedAtMs: number | null;
  nowMs: number;
  significantMoveMeters: number;
  minUpdateIntervalSeconds: number;
}): boolean {
  if (input.previous === null || input.lastAcceptedAtMs === null) {
    return true;
  }
  if (haversineMeters(input.previous, input.next) < input.significantMoveMeters) {
    return false;
  }
  return input.nowMs - input.lastAcceptedAtMs >= input.minUpdateIntervalSeconds * 1000;
}

export function shouldRefreshNearby(input: {
  previousCellId: string | null;
  next: GeoPoint;
  cellSizeMeters: number;
  lastNearbyAtMs: number | null;
  nowMs: number;
  nearbyTtlSeconds: number;
  filtersChanged: boolean;
}): boolean {
  if (input.filtersChanged) {
    return true;
  }
  const cellId = snapToGrid(input.next, input.cellSizeMeters).cellId;
  if (input.previousCellId === null || input.previousCellId !== cellId) {
    return true;
  }
  if (input.lastNearbyAtMs === null) {
    return true;
  }
  return input.nowMs - input.lastNearbyAtMs >= input.nearbyTtlSeconds * 1000;
}
