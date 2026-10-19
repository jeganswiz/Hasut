import { LiveViewerRegistry } from "./live-viewer-registry";

describe("LiveViewerRegistry", () => {
  it("counts distinct members, not sockets", () => {
    const registry = new LiveViewerRegistry();
    expect(registry.join("live-1", "a")).toBe(1);
    expect(registry.join("live-1", "a")).toBe(1);
    expect(registry.join("live-1", "b")).toBe(2);
    expect(registry.leave("live-1", "a")).toBe(2);
    expect(registry.leave("live-1", "a")).toBe(1);
    expect(registry.viewers("live-1")).toEqual(["b"]);
    expect(registry.isWatching("live-1", "b")).toBe(true);
  });

  it("forgets an empty room", () => {
    const registry = new LiveViewerRegistry();
    registry.join("live-1", "a");
    registry.leave("live-1", "a");
    expect(registry.count("live-1")).toBe(0);
    expect(registry.leave("live-1", "ghost")).toBe(0);
  });
});
