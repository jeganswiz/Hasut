import { containsExactCoordinateKeys } from "@hasut/utils";
import { buildMemberPresenceMarker, cellRoom } from "./presence-payload";

describe("buildMemberPresenceMarker", () => {
  it("returns a snapped marker without exact coordinate keys", () => {
    const marker = buildMemberPresenceMarker({
      memberId: "11111111-1111-4111-8111-111111111111",
      displayName: "Asha",
      pinLat: 13.04,
      pinLng: 80.23,
      rating: null,
    });
    expect(marker.kind).toBe("MEMBER");
    expect(marker.pinLat).toBe(13.04);
    expect(containsExactCoordinateKeys(marker)).toBe(false);
    expect(marker).not.toHaveProperty("latitude");
    expect(marker).not.toHaveProperty("longitude");
  });
});

describe("cellRoom", () => {
  it("prefixes snapped cell ids", () => {
    expect(cellRoom("12:34")).toBe("cell:12:34");
  });
});
