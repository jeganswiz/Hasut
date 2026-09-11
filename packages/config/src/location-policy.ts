export interface LocationPolicy {
  cellSizeMeters: number;
  maxAccuracyMeters: number;
  minUpdateIntervalSeconds: number;
  serviceAreaMinRadiusMeters: number;
  serviceAreaMaxRadiusMeters: number;
}

export const LOCATION_POLICY_CONFIG_KEY = "location.policy";

/** Seed / fallback values owned by configuration, not location use-cases. */
export const LOCATION_POLICY_DEFAULTS: LocationPolicy = {
  cellSizeMeters: 400,
  maxAccuracyMeters: 250,
  minUpdateIntervalSeconds: 15,
  serviceAreaMinRadiusMeters: 500,
  serviceAreaMaxRadiusMeters: 50_000,
};

export function isLocationPolicy(value: unknown): value is LocationPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.cellSizeMeters === "number" &&
    typeof record.maxAccuracyMeters === "number" &&
    typeof record.minUpdateIntervalSeconds === "number"
  );
}

export function readLocationPolicy(value: unknown): LocationPolicy {
  if (!isLocationPolicy(value)) {
    return LOCATION_POLICY_DEFAULTS;
  }
  const record = value as LocationPolicy & Record<string, unknown>;
  return {
    ...LOCATION_POLICY_DEFAULTS,
    ...record,
    serviceAreaMinRadiusMeters:
      typeof record.serviceAreaMinRadiusMeters === "number"
        ? record.serviceAreaMinRadiusMeters
        : LOCATION_POLICY_DEFAULTS.serviceAreaMinRadiusMeters,
    serviceAreaMaxRadiusMeters:
      typeof record.serviceAreaMaxRadiusMeters === "number"
        ? record.serviceAreaMaxRadiusMeters
        : LOCATION_POLICY_DEFAULTS.serviceAreaMaxRadiusMeters,
  };
}
