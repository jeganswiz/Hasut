export interface DiscoveryPolicy {
  defaultRadiusMeters: number;
  minRadiusMeters: number;
  maxRadiusMeters: number;
  radiusOptionsMeters: number[];
  clusterCellMeters: number;
  includeMembers: boolean;
  availableCodes: string[];
  availableModeCodes: string[];
  mapTileUrl: string;
  distanceBucketStepsMeters: number[];
  activityHalfLifeHours: number;
  professionalMatch: "service_area" | "presence" | "either";
  demoLatitude: number;
  demoLongitude: number;
}

export const DISCOVERY_POLICY_CONFIG_KEY = "discovery.policy";

/** Seed / fallback values owned by configuration, not discovery use-cases. */
export const DISCOVERY_POLICY_DEFAULTS: DiscoveryPolicy = {
  defaultRadiusMeters: 5_000,
  minRadiusMeters: 500,
  maxRadiusMeters: 50_000,
  radiusOptionsMeters: [1_000, 2_000, 5_000, 10_000, 25_000],
  clusterCellMeters: 400,
  includeMembers: true,
  availableCodes: ["AVAILABLE"],
  availableModeCodes: ["AVAILABLE", "LOOKING_FOR_WORK", "PROMOTING_SERVICE"],
  mapTileUrl: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  distanceBucketStepsMeters: [200, 400, 600, 800, 1_100, 2_000, 5_000],
  activityHalfLifeHours: 72,
  professionalMatch: "either",
  demoLatitude: 13.0418,
  demoLongitude: 80.2341,
};

export function isDiscoveryPolicy(value: unknown): value is DiscoveryPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.defaultRadiusMeters === "number" &&
    typeof record.minRadiusMeters === "number" &&
    typeof record.maxRadiusMeters === "number" &&
    Array.isArray(record.radiusOptionsMeters) &&
    typeof record.clusterCellMeters === "number"
  );
}

export function readDiscoveryPolicy(value: unknown): DiscoveryPolicy {
  if (!isDiscoveryPolicy(value)) {
    return DISCOVERY_POLICY_DEFAULTS;
  }
  const record = value as DiscoveryPolicy & Record<string, unknown>;
  return {
    ...DISCOVERY_POLICY_DEFAULTS,
    ...record,
    radiusOptionsMeters:
      Array.isArray(record.radiusOptionsMeters) && record.radiusOptionsMeters.length > 0
        ? record.radiusOptionsMeters
        : DISCOVERY_POLICY_DEFAULTS.radiusOptionsMeters,
    availableCodes:
      Array.isArray(record.availableCodes) && record.availableCodes.length > 0
        ? record.availableCodes
        : DISCOVERY_POLICY_DEFAULTS.availableCodes,
    availableModeCodes:
      Array.isArray(record.availableModeCodes) && record.availableModeCodes.length > 0
        ? record.availableModeCodes
        : DISCOVERY_POLICY_DEFAULTS.availableModeCodes,
    distanceBucketStepsMeters:
      Array.isArray(record.distanceBucketStepsMeters) && record.distanceBucketStepsMeters.length > 0
        ? record.distanceBucketStepsMeters
        : DISCOVERY_POLICY_DEFAULTS.distanceBucketStepsMeters,
  };
}

export interface DiscoveryRankingWeights {
  distance: number;
  categoryRelevance: number;
  availability: number;
  verification: number;
  rating: number;
  activity: number;
}

export const DISCOVERY_RANKING_DEFAULTS: DiscoveryRankingWeights = {
  distance: 0.28,
  categoryRelevance: 0.2,
  availability: 0.16,
  verification: 0.14,
  rating: 0.14,
  activity: 0.08,
};

export function isDiscoveryRankingWeights(value: unknown): value is DiscoveryRankingWeights {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.distance === "number" &&
    typeof record.categoryRelevance === "number" &&
    typeof record.availability === "number" &&
    typeof record.verification === "number" &&
    typeof record.rating === "number" &&
    typeof record.activity === "number"
  );
}

export function normalizeRankingWeights(weights: DiscoveryRankingWeights): DiscoveryRankingWeights {
  const total =
    weights.distance +
    weights.categoryRelevance +
    weights.availability +
    weights.verification +
    weights.rating +
    weights.activity;
  if (total <= 0) {
    return DISCOVERY_RANKING_DEFAULTS;
  }
  return {
    distance: weights.distance / total,
    categoryRelevance: weights.categoryRelevance / total,
    availability: weights.availability / total,
    verification: weights.verification / total,
    rating: weights.rating / total,
    activity: weights.activity / total,
  };
}
