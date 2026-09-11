import { diffDiscoveryMarkers, mergePresenceMarker } from "./discovery-markers";

const pin = (id: string, lat: number) => ({
  id,
  kind: "MEMBER" as const,
  label: id,
  rating: null,
  selected: false,
  pinLat: lat,
  pinLng: 80,
});

describe("mergePresenceMarker", () => {
  it("updates a known marker pin without growing the list", () => {
    const merged = mergePresenceMarker([pin("a", 13), pin("b", 13.1)], pin("a", 13.2));
    expect(merged).toHaveLength(2);
    expect(merged[0]?.pinLat).toBe(13.2);
    expect(merged[1]?.id).toBe("b");
  });

  it("ignores unknown ids so client memory stays bounded", () => {
    const current = [pin("a", 13)];
    expect(mergePresenceMarker(current, pin("stranger", 13.3))).toEqual(current);
  });
});

describe("diffDiscoveryMarkers", () => {
  it("adds, updates, and removes by id", () => {
    const diff = diffDiscoveryMarkers(["a", "b"], [pin("b", 13.1), pin("c", 13.2)]);
    expect(diff.remove).toEqual(["a"]);
    expect(diff.update.map((marker) => marker.id)).toEqual(["b"]);
    expect(diff.add.map((marker) => marker.id)).toEqual(["c"]);
  });
});
