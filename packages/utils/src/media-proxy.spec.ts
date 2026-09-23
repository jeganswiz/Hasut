import { mediaOrigin, mediaProxyTarget, resolveMediaUrl, safeMediaSubpath } from "./media-proxy";

describe("mediaOrigin", () => {
  it("falls back to the local MediaMTX port when the base is empty", () => {
    expect(mediaOrigin("", "http://127.0.0.1:8888")).toBe("http://127.0.0.1:8888");
    expect(mediaOrigin(" http://cdn.example/ ", "http://127.0.0.1:8888")).toBe(
      "http://cdn.example",
    );
  });
});

describe("safeMediaSubpath", () => {
  it("keeps a playlist path and rejects traversal", () => {
    expect(safeMediaSubpath("/stories/s1/index.m3u8")).toBe("stories/s1/index.m3u8");
    expect(safeMediaSubpath("../etc/passwd")).toBeNull();
    expect(safeMediaSubpath("stories/../../secret")).toBeNull();
    expect(safeMediaSubpath("http://evil.example/x")).toBeNull();
    expect(safeMediaSubpath("")).toBeNull();
  });
});

describe("mediaProxyTarget", () => {
  it("joins the origin, path, and query", () => {
    expect(mediaProxyTarget("http://127.0.0.1:8888", "stories/s1/index.m3u8", "?token=1")).toBe(
      "http://127.0.0.1:8888/stories/s1/index.m3u8?token=1",
    );
  });
});

describe("resolveMediaUrl", () => {
  it("prefixes a relative media path with the API origin", () => {
    expect(resolveMediaUrl("/media/hls/stories/s1/index.m3u8", "http://192.168.1.8:3001/")).toBe(
      "http://192.168.1.8:3001/media/hls/stories/s1/index.m3u8",
    );
    expect(resolveMediaUrl("https://cdn.example/s1.m3u8", "http://localhost:3001")).toBe(
      "https://cdn.example/s1.m3u8",
    );
    expect(resolveMediaUrl("/media/audio/marina.m4a", "http://localhost:3001")).toBeNull();
    expect(resolveMediaUrl("/other/file", "http://localhost:3001")).toBeNull();
    expect(resolveMediaUrl("/media/hls/x", "not-a-url")).toBeNull();
  });
});
