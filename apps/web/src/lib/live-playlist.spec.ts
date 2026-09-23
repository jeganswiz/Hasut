import { isLivePlaylist } from "./live-playlist";

describe("isLivePlaylist", () => {
  it("accepts an HLS document", () => {
    expect(isLivePlaylist(200, "#EXTM3U\n#EXT-X-VERSION:3\n")).toBe(true);
  });

  it("rejects a missing or empty playlist", () => {
    expect(isLivePlaylist(404, "#EXTM3U")).toBe(false);
    expect(isLivePlaylist(200, "not a playlist")).toBe(false);
  });
});
