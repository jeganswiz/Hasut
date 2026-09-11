import { containsExactCoordinateKeys, isValidWgs84, snapToGrid } from "./geo";

describe("geo", () => {
  it("snaps nearby points into the same cell", () => {
    const a = snapToGrid({ latitude: 12.9716, longitude: 77.5946 }, 400);
    const b = snapToGrid({ latitude: 12.972, longitude: 77.595 }, 400);
    expect(a.cellId).toBe(b.cellId);
    expect(a.latitude).not.toBe(12.9716);
  });

  it("rejects invalid WGS84", () => {
    expect(isValidWgs84(91, 0)).toBe(false);
    expect(isValidWgs84(12.97, 77.59)).toBe(true);
  });

  it("detects exact coordinate keys in a payload", () => {
    expect(containsExactCoordinateKeys({ approximateLocation: { label: "Bengaluru" } })).toBe(
      false,
    );
    expect(containsExactCoordinateKeys({ exact: { latitude: 1, longitude: 2 } })).toBe(true);
  });
});
