import type { LiveSessionView, StoryView } from "@hasut/types";
import {
  initialPresenceTab,
  isHlsDocument,
  livePlaybackUri,
  liveStageCopy,
  presenceEmpty,
  storyAudioUri,
  storyPlaybackUri,
  storyStageCopy,
} from "./presence-state";

const API_ORIGIN = "http://localhost:3001";

function story(overrides: Partial<StoryView> = {}): StoryView {
  return {
    id: "s1",
    memberId: "m1",
    kind: "IMAGE",
    imageUrl: "https://cdn.example/still.jpg",
    hlsUrl: null,
    previewHlsUrl: null,
    audioUrl: null,
    audio: {
      source: "NONE",
      trackId: null,
      title: null,
      url: null,
      startSeconds: 0,
      endSeconds: null,
    },
    caption: "Shop board",
    captionColor: null,
    trimStartSeconds: 0,
    trimEndSeconds: null,
    originalAudioMode: "KEEP",
    audience: "EVERYONE",
    playbackStatus: "READY",
    expiresAt: "2026-09-21T00:00:00.000Z",
    moderationStatus: "ACTIVE",
    createdAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

function live(overrides: Partial<LiveSessionView> = {}): LiveSessionView {
  return {
    id: "live-1",
    memberId: "m1",
    title: "Shop board",
    audience: "PATRONS",
    status: "LIVE",
    hlsUrl: "/media/hls/live/1/index.m3u8",
    previewHlsUrl: "/media/hls/live/1/index.m3u8",
    ingestUrl: null,
    startedAt: "2026-09-20T00:00:00.000Z",
    endedAt: null,
    ...overrides,
  };
}

describe("presenceEmpty", () => {
  it("is empty only when there is no story and no live", () => {
    expect(presenceEmpty([], null)).toBe(true);
    expect(presenceEmpty([story()], null)).toBe(false);
    expect(presenceEmpty([], live())).toBe(false);
  });
});

describe("initialPresenceTab", () => {
  it("opens Live when a session is visible", () => {
    expect(initialPresenceTab([], live())).toBe("live");
    expect(initialPresenceTab([story()], null)).toBe("activity");
  });
});

describe("storyStageCopy", () => {
  it("labels a pending video and leaves an image silent", () => {
    expect(storyStageCopy(story({ kind: "VIDEO", playbackStatus: "PENDING" }), API_ORIGIN)).toBe(
      "Preparing playback",
    );
    expect(storyStageCopy(story(), API_ORIGIN)).toBe("");
  });
});

describe("storyPlaybackUri", () => {
  it("resolves a relative playlist against the API origin", () => {
    expect(
      storyPlaybackUri(story({ kind: "VIDEO", playbackStatus: "PENDING" }), API_ORIGIN),
    ).toBeNull();
    expect(
      storyPlaybackUri(
        story({
          kind: "VIDEO",
          playbackStatus: "READY",
          hlsUrl: "/media/hls/stories/s1/index.m3u8",
        }),
        API_ORIGIN,
      ),
    ).toBe("http://localhost:3001/media/hls/stories/s1/index.m3u8");
    expect(
      storyPlaybackUri(
        story({
          kind: "VIDEO",
          playbackStatus: "READY",
          hlsUrl: "https://cdn.example/stories/s1/index.m3u8",
        }),
        API_ORIGIN,
      ),
    ).toBe("https://cdn.example/stories/s1/index.m3u8");
  });
});

describe("storyAudioUri", () => {
  it("plays an absolute track only when the added sound should be heard", () => {
    expect(
      storyAudioUri(
        story({
          audio: {
            source: "LIBRARY",
            trackId: "t1",
            title: "Marina Morning",
            url: "https://cdn.example/marina.m4a",
            startSeconds: 5,
            endSeconds: 20,
          },
        }),
        API_ORIGIN,
      ),
    ).toBe("https://cdn.example/marina.m4a");
    expect(
      storyAudioUri(
        story({
          kind: "VIDEO",
          originalAudioMode: "KEEP",
          audio: {
            source: "LIBRARY",
            trackId: "t1",
            title: "Marina Morning",
            url: "https://cdn.example/marina.m4a",
            startSeconds: 0,
            endSeconds: null,
          },
        }),
        API_ORIGIN,
      ),
    ).toBeNull();
    expect(
      storyAudioUri(
        story({
          audio: {
            source: "LIBRARY",
            trackId: "t1",
            title: "Marina Morning",
            url: "/media/audio/marina.m4a",
            startSeconds: 0,
            endSeconds: null,
          },
        }),
        API_ORIGIN,
      ),
    ).toBeNull();
  });
});

describe("livePlaybackUri", () => {
  it("resolves a relative live playlist against the API origin", () => {
    expect(livePlaybackUri(live(), API_ORIGIN)).toBe(
      "http://localhost:3001/media/hls/live/1/index.m3u8",
    );
    expect(
      livePlaybackUri(live({ hlsUrl: "https://cdn.example/live/1/index.m3u8" }), API_ORIGIN),
    ).toBe("https://cdn.example/live/1/index.m3u8");
  });
});

describe("isHlsDocument", () => {
  it("accepts an HLS playlist body", () => {
    expect(isHlsDocument(200, "#EXTM3U\n#EXT-X-VERSION:3\n")).toBe(true);
    expect(isHlsDocument(404, "#EXTM3U")).toBe(false);
    expect(isHlsDocument(200, "not a playlist")).toBe(false);
  });
});

describe("liveStageCopy", () => {
  it("waits only when no playlist can be resolved", () => {
    expect(liveStageCopy(live({ hlsUrl: null, previewHlsUrl: null }), API_ORIGIN)).toBe(
      "Waiting for the live preview",
    );
    expect(liveStageCopy(live(), API_ORIGIN)).toBe("Visible to Patrons");
  });
});
