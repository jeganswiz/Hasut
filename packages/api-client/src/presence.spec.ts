import { parseDiscoveryPresenceUpdated } from "./presence";

describe("parseDiscoveryPresenceUpdated", () => {
  it("accepts a snapped marker payload", () => {
    const parsed = parseDiscoveryPresenceUpdated({
      marker: {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "MEMBER",
        label: "Asha",
        rating: null,
        selected: false,
        pinLat: 13.04,
        pinLng: 80.23,
        photoUrl: null,
        initials: "AS",
        available: true,
        ring: "available",
        pinMediaKind: "PROFILE",
        previewHlsUrl: null,
      },
    });
    expect(parsed?.marker.pinLat).toBe(13.04);
    expect(parsed?.marker).not.toHaveProperty("latitude");
  });

  it("rejects exact coordinate payloads", () => {
    expect(
      parseDiscoveryPresenceUpdated({
        marker: { id: "x", latitude: 13.04, longitude: 80.23 },
      }),
    ).toBeNull();
  });
});
