import { DISCOVERY_POLICY_DEFAULTS } from "@hasut/config";
import { clusterRanked, rankNearbyRows } from "./discovery.ranking";
import type { NearbyRow } from "./discovery.repository";

function row(overrides: Partial<NearbyRow> & Pick<NearbyRow, "id" | "distanceMeters">): NearbyRow {
  return {
    kind: "PROFESSIONAL",
    title: overrides.id,
    subtitle: "Pro",
    photoMediaId: null,
    categoryLabel: "Home services",
    categoryIds: [],
    availability: "AVAILABLE",
    modeCode: null,
    verified: false,
    rating: null,
    reviewCount: 0,
    pinLat: 12.97,
    pinLng: 77.59,
    updatedAt: new Date(),
    locationLabel: "Bengaluru",
    city: "Bengaluru",
    region: "Karnataka",
    country: "India",
    countryCode: "IN",
    ...overrides,
  };
}

describe("rankNearbyRows", () => {
  it("orders closer results first when distance is the only weight", () => {
    const ranked = rankNearbyRows(
      [
        row({ id: "far", distanceMeters: 4_000, title: "Far" }),
        row({ id: "near", distanceMeters: 200, title: "Near" }),
      ],
      {
        weights: {
          distance: 1,
          categoryRelevance: 0,
          availability: 0,
          verification: 0,
          rating: 0,
          activity: 0,
        },
        policy: DISCOVERY_POLICY_DEFAULTS,
        radiusMeters: 5_000,
      },
    );
    expect(ranked.map((item) => item.id)).toEqual(["near", "far"]);
    expect(ranked[0]?.distanceBucket).toBe("200m");
  });

  it("promotes verified results when verification weight increases", () => {
    const ranked = rankNearbyRows(
      [
        row({ id: "plain", distanceMeters: 200, verified: false }),
        row({ id: "trusted", distanceMeters: 200, verified: true }),
      ],
      {
        weights: {
          distance: 0,
          categoryRelevance: 0,
          availability: 0,
          verification: 1,
          rating: 0,
          activity: 0,
        },
        policy: DISCOVERY_POLICY_DEFAULTS,
        radiusMeters: 5_000,
      },
    );
    expect(ranked[0]?.id).toBe("trusted");
  });

  it("uses rating and availability from configuration, not hardcoded scores", () => {
    const ranked = rankNearbyRows(
      [
        row({
          id: "busy",
          distanceMeters: 100,
          availability: "BUSY",
          rating: 2,
        }),
        row({
          id: "open",
          distanceMeters: 100,
          availability: "AVAILABLE",
          rating: 5,
        }),
      ],
      {
        weights: {
          distance: 0,
          categoryRelevance: 0,
          availability: 0.5,
          verification: 0,
          rating: 0.5,
          activity: 0,
        },
        policy: DISCOVERY_POLICY_DEFAULTS,
        radiusMeters: 5_000,
      },
    );
    expect(ranked[0]?.id).toBe("open");
    expect(ranked[0]?.available).toBe(true);
    expect(ranked[1]?.available).toBe(false);
  });
});

describe("clusterRanked", () => {
  it("clusters pins that share a cell and leaves singles unclustered", () => {
    const ranked = rankNearbyRows(
      [
        row({ id: "a", distanceMeters: 100, pinLat: 12.97, pinLng: 77.59 }),
        row({ id: "b", distanceMeters: 120, pinLat: 12.97, pinLng: 77.59 }),
        row({ id: "c", distanceMeters: 800, pinLat: 13.1, pinLng: 77.7 }),
      ],
      {
        weights: {
          distance: 1,
          categoryRelevance: 0,
          availability: 0,
          verification: 0,
          rating: 0,
          activity: 0,
        },
        policy: DISCOVERY_POLICY_DEFAULTS,
        radiusMeters: 5_000,
      },
    );
    const clusters = clusterRanked(ranked, 400);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.count).toBe(2);
  });
});
