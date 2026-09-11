import { LOCATION_POLICY_DEFAULTS, isLocationPolicy, readLocationPolicy } from "./location-policy";

describe("isLocationPolicy", () => {
  it("accepts the seeded default policy", () => {
    expect(isLocationPolicy(LOCATION_POLICY_DEFAULTS)).toBe(true);
  });
});

describe("readLocationPolicy", () => {
  it("fills service-area radius from defaults when older rows omit them", () => {
    const policy = readLocationPolicy({
      cellSizeMeters: 400,
      maxAccuracyMeters: 250,
      minUpdateIntervalSeconds: 15,
    });
    expect(policy.minUpdateIntervalSeconds).toBe(15);
    expect(policy.significantMoveMeters).toBe(LOCATION_POLICY_DEFAULTS.significantMoveMeters);
    expect(policy.geolocationTimeoutMs).toBe(LOCATION_POLICY_DEFAULTS.geolocationTimeoutMs);
    expect(policy.serviceAreaMinRadiusMeters).toBe(
      LOCATION_POLICY_DEFAULTS.serviceAreaMinRadiusMeters,
    );
    expect(policy.serviceAreaMaxRadiusMeters).toBe(
      LOCATION_POLICY_DEFAULTS.serviceAreaMaxRadiusMeters,
    );
  });
});
