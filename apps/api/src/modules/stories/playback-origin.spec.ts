import { livePlaybackUrls, storyPlaybackUrls } from "./playback-origin";

describe("storyPlaybackUrls", () => {
  it("uses one MediaMTX playlist for playback and the map preview", () => {
    expect(storyPlaybackUrls("story-1", "http://127.0.0.1:8888/")).toEqual({
      hlsUrl: "http://127.0.0.1:8888/stories/story-1/index.m3u8",
      previewHlsUrl: "http://127.0.0.1:8888/stories/story-1/index.m3u8",
    });
  });

  it("stays relative when no HLS origin is configured", () => {
    expect(storyPlaybackUrls("story-1", "").hlsUrl).toBe("/media/hls/stories/story-1/index.m3u8");
  });
});

describe("livePlaybackUrls", () => {
  it("keeps WHIP on its own origin", () => {
    expect(livePlaybackUrls("live-1", "http://127.0.0.1:8888", "http://127.0.0.1:8889")).toEqual({
      hlsUrl: "http://127.0.0.1:8888/live/live-1/index.m3u8",
      previewHlsUrl: "http://127.0.0.1:8888/live/live-1/index.m3u8",
      ingestUrl: "http://127.0.0.1:8889/live/live-1/whip",
    });
  });

  it("does not send ingest to the HLS fallback when WHIP is unset", () => {
    const urls = livePlaybackUrls("live-1", "", "");
    expect(urls.hlsUrl).toBe("/media/hls/live/live-1/index.m3u8");
    expect(urls.ingestUrl).toBe("/media/whip/live/live-1/whip");
  });
});
