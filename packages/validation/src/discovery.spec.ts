import { discoveryPolicyPatchSchema, discoveryQuerySchema } from "./discovery";

describe("discoveryQuerySchema", () => {
  it("parses nearby filters from query strings", () => {
    const parsed = discoveryQuerySchema.parse({
      latitude: "12.97",
      longitude: "77.59",
      radiusMeters: "5000",
      kinds: "PROFESSIONAL,BUSINESS",
      verified: "true",
      available: "false",
      q: "ac repair",
    });
    expect(parsed.latitude).toBeCloseTo(12.97);
    expect(parsed.kinds).toEqual(["PROFESSIONAL", "BUSINESS"]);
    expect(parsed.verified).toBe(true);
    expect(parsed.available).toBe(false);
    expect(parsed.q).toBe("ac repair");
  });

  it("rejects an unknown discovery kind", () => {
    expect(() => discoveryQuerySchema.parse({ kinds: "UNKNOWN" })).toThrow();
  });
});

describe("discoveryPolicyPatchSchema", () => {
  it("requires at least one admin field", () => {
    expect(() => discoveryPolicyPatchSchema.parse({})).toThrow();
    expect(
      discoveryPolicyPatchSchema.parse({ defaultRadiusMeters: 8_000 }).defaultRadiusMeters,
    ).toBe(8_000);
  });

  it("accepts a Leaflet XYZ template as a custom tile override", () => {
    expect(
      discoveryPolicyPatchSchema.parse({
        mapProvider: "stadia",
        mapCustomTileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      }).mapProvider,
    ).toBe("stadia");
  });
});
