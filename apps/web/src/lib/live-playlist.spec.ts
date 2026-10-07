import { isLivePlaylist, playlistIsReady } from "./live-playlist";

describe("isLivePlaylist", () => {
  it("accepts an HLS document", () => {
    expect(isLivePlaylist(200, "#EXTM3U\n#EXT-X-VERSION:3\n")).toBe(true);
  });

  it("rejects a missing or empty playlist", () => {
    expect(isLivePlaylist(404, "#EXTM3U")).toBe(false);
    expect(isLivePlaylist(200, "not a playlist")).toBe(false);
  });
});

describe("playlistIsReady", () => {
  it("asks the quiet probe for a relative playlist", async () => {
    const requested: string[] = [];
    const ready = await playlistIsReady("/media/hls/live/abc/index.m3u8", async (url) => {
      requested.push(String(url));
      return new Response(JSON.stringify({ ready: false }), { status: 200 });
    });
    expect(ready).toBe(false);
    expect(requested).toEqual(["/media/hls-probe?src=%2Fmedia%2Fhls%2Flive%2Fabc%2Findex.m3u8"]);
  });

  it("reads an absolute playlist directly", async () => {
    const ready = await playlistIsReady(
      "http://127.0.0.1:18888/live/ready/index.m3u8",
      async () => {
        return new Response("#EXTM3U\n", { status: 200 });
      },
    );
    expect(ready).toBe(true);
  });
});
