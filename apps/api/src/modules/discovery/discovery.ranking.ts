import type { DiscoveryPolicy, DiscoveryRankingWeights } from "@hasut/config";
import { bucketDistanceMeters, snapToGrid } from "@hasut/utils";
import type { NearbyRow } from "./discovery.repository";

export interface RankedNearby extends NearbyRow {
  score: number;
  distanceBucket: string;
  available: boolean;
}

export function rankNearbyRows(
  rows: NearbyRow[],
  input: {
    weights: DiscoveryRankingWeights;
    policy: DiscoveryPolicy;
    radiusMeters: number;
    categoryId?: string;
    categoryFamily?: Set<string>;
  },
): RankedNearby[] {
  const now = Date.now();
  return rows
    .map((row) => {
      const distanceMeters = Number(row.distanceMeters);
      const distanceScore = 1 - Math.min(distanceMeters / input.radiusMeters, 1);
      const categoryIds = Array.isArray(row.categoryIds) ? row.categoryIds : [];
      const normalized = { ...row, categoryIds };
      const categoryScore = categoryRelevance(normalized, input.categoryId, input.categoryFamily);
      const available = isAvailable(row, input.policy);
      const availabilityScore = available ? 1 : 0;
      const verificationScore = row.verified ? 1 : 0;
      const ratingScore = row.rating === null ? 0 : Math.min(Number(row.rating) / 5, 1);
      const ageHours = Math.max(0, (now - new Date(row.updatedAt).getTime()) / 3_600_000);
      const activityScore = Math.exp(-ageHours / input.policy.activityHalfLifeHours);
      const score =
        input.weights.distance * distanceScore +
        input.weights.categoryRelevance * categoryScore +
        input.weights.availability * availabilityScore +
        input.weights.verification * verificationScore +
        input.weights.rating * ratingScore +
        input.weights.activity * activityScore;
      return {
        ...normalized,
        distanceMeters,
        pinLat: Number(row.pinLat),
        pinLng: Number(row.pinLng),
        rating: row.rating === null ? null : Number(row.rating),
        reviewCount: Number(row.reviewCount),
        score,
        available,
        distanceBucket: bucketDistanceMeters(
          distanceMeters,
          input.policy.distanceBucketStepsMeters,
        ),
      };
    })
    .sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters);
}

export function clusterRanked(
  rows: RankedNearby[],
  cellSizeMeters: number,
): Array<{
  cellId: string;
  pinLat: number;
  pinLng: number;
  count: number;
  kinds: RankedNearby["kind"][];
}> {
  const groups = new Map<string, RankedNearby[]>();
  for (const row of rows) {
    const snapped = snapToGrid({ latitude: row.pinLat, longitude: row.pinLng }, cellSizeMeters);
    const current = groups.get(snapped.cellId) ?? [];
    current.push(row);
    groups.set(snapped.cellId, current);
  }
  const clusters: Array<{
    cellId: string;
    pinLat: number;
    pinLng: number;
    count: number;
    kinds: RankedNearby["kind"][];
  }> = [];
  for (const [cellId, items] of groups) {
    if (items.length < 2) {
      continue;
    }
    const first = items[0];
    if (first === undefined) {
      continue;
    }
    const snapped = snapToGrid({ latitude: first.pinLat, longitude: first.pinLng }, cellSizeMeters);
    clusters.push({
      cellId,
      pinLat: snapped.latitude,
      pinLng: snapped.longitude,
      count: items.length,
      kinds: [...new Set(items.map((item) => item.kind))],
    });
  }
  return clusters;
}

function categoryRelevance(
  row: NearbyRow,
  categoryId: string | undefined,
  family: Set<string> | undefined,
): number {
  if (categoryId === undefined) {
    return row.categoryIds.length > 0 ? 1 : 0.35;
  }
  if (row.categoryIds.includes(categoryId)) {
    return 1;
  }
  if (family !== undefined && row.categoryIds.some((id) => family.has(id))) {
    return 0.7;
  }
  return 0;
}

function isAvailable(row: NearbyRow, policy: DiscoveryPolicy): boolean {
  if (row.kind === "PROFESSIONAL") {
    return row.availability !== null && policy.availableCodes.includes(row.availability);
  }
  if (row.kind === "MEMBER") {
    return row.modeCode !== null && policy.availableModeCodes.includes(row.modeCode);
  }
  return true;
}
