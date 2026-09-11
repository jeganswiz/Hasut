import {
  DISCOVERY_POLICY_DEFAULTS,
  DISCOVERY_RANKING_DEFAULTS,
  normalizeRankingWeights,
  readDiscoveryPolicy,
} from "./discovery";

describe("readDiscoveryPolicy", () => {
  it("returns defaults when the stored value is missing", () => {
    expect(readDiscoveryPolicy(null)).toEqual(DISCOVERY_POLICY_DEFAULTS);
  });

  it("keeps admin radius options when present", () => {
    const policy = readDiscoveryPolicy({
      ...DISCOVERY_POLICY_DEFAULTS,
      defaultRadiusMeters: 10_000,
      radiusOptionsMeters: [2_000, 10_000],
    });
    expect(policy.defaultRadiusMeters).toBe(10_000);
    expect(policy.radiusOptionsMeters).toEqual([2_000, 10_000]);
  });

  it("fills search debounce from defaults when older rows omit it", () => {
    const { searchDebounceMs: _ignored, ...legacy } = DISCOVERY_POLICY_DEFAULTS;
    expect(readDiscoveryPolicy(legacy).searchDebounceMs).toBe(
      DISCOVERY_POLICY_DEFAULTS.searchDebounceMs,
    );
  });
});

describe("normalizeRankingWeights", () => {
  it("normalizes weights so they sum to 1", () => {
    const weights = normalizeRankingWeights({
      distance: 2,
      categoryRelevance: 1,
      availability: 1,
      verification: 0,
      rating: 0,
      activity: 0,
    });
    expect(weights.distance).toBeCloseTo(0.5);
    expect(weights.categoryRelevance).toBeCloseTo(0.25);
    expect(weights.availability).toBeCloseTo(0.25);
  });

  it("falls back to defaults when every weight is zero", () => {
    expect(
      normalizeRankingWeights({
        distance: 0,
        categoryRelevance: 0,
        availability: 0,
        verification: 0,
        rating: 0,
        activity: 0,
      }),
    ).toEqual(DISCOVERY_RANKING_DEFAULTS);
  });
});
