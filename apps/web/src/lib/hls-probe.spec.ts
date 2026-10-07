import { hlsProbeTarget, hlsProbeUrl, readHlsProbe } from "./hls-probe";

describe("hlsProbeUrl", () => {
  it("points a relative playlist at the quiet probe", () => {
    expect(hlsProbeUrl("/media/hls/live/abc/index.m3u8")).toBe(
      "/media/hls-probe?src=%2Fmedia%2Fhls%2Flive%2Fabc%2Findex.m3u8",
    );
    expect(hlsProbeUrl("http://127.0.0.1:8888/live/abc/index.m3u8")).toBeNull();
  });
});

describe("hlsProbeTarget", () => {
  it("asks the local HLS origin for the playlist path", () => {
    expect(hlsProbeTarget("/media/hls/live/abc/index.m3u8", "")).toBe(
      "http://127.0.0.1:8888/live/abc/index.m3u8",
    );
  });

  it("refuses a path that leaves the media root", () => {
    expect(hlsProbeTarget("/media/hls/../secret", "")).toBeNull();
    expect(hlsProbeTarget("http://evil.example/live/abc/index.m3u8", "")).toBeNull();
  });
});

describe("readHlsProbe", () => {
  it("reports a missing playlist without forwarding the 404", async () => {
    const result = await readHlsProbe("/media/hls/live/abc/index.m3u8", "", async () => {
      return new Response("missing", { status: 404 });
    });
    expect(result).toEqual({ status: 200, ready: false });
  });

  it("reports a real playlist as ready", async () => {
    const result = await readHlsProbe("/media/hls/live/abc/index.m3u8", "", async () => {
      return new Response("#EXTM3U\n", { status: 200 });
    });
    expect(result).toEqual({ status: 200, ready: true });
  });
});
