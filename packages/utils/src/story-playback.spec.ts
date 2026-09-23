import type { StoryView } from "@hasut/types";
import {
  loopWithin,
  mutesOriginalAudio,
  playsAddedAudio,
  reachablePlaybackUrl,
  storyAudioSrc,
  storyVisualState,
} from "./story-playback";

function story(overrides: Partial<StoryView> = {}): StoryView {
  return {
    id: "s1",
    memberId: "m1",
    kind: "VIDEO",
    imageUrl: null,
    hlsUrl: "/a.m3u8",
    previewHlsUrl: "/p.m3u8",
    audioUrl: "https://cdn.example/upload.m4a",
    audio: {
      source: "LIBRARY",
      trackId: "t1",
      title: "Marina Morning — HASUT Sound",
      url: "https://cdn.example/marina.m4a",
      startSeconds: 5,
      endSeconds: 20,
    },
    caption: "Rewiring",
    captionColor: "#EAB308",
    trimStartSeconds: 3,
    trimEndSeconds: 18,
    originalAudioMode: "MUTE",
    audience: "EVERYONE",
    playbackStatus: "READY",
    expiresAt: "2026-09-21T00:00:00.000Z",
    moderationStatus: "ACTIVE",
    createdAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("playsAddedAudio", () => {
  it("plays a library track on an image even when the mode is KEEP", () => {
    expect(playsAddedAudio("IMAGE", "KEEP", "LIBRARY")).toBe(true);
  });

  it("ignores a stored track on a video when the member kept the original", () => {
    expect(playsAddedAudio("VIDEO", "KEEP", "LIBRARY")).toBe(false);
  });

  it("plays the added track when the original is muted or layered", () => {
    expect(playsAddedAudio("VIDEO", "MUTE", "UPLOAD")).toBe(true);
    expect(playsAddedAudio("VIDEO", "OVERLAY", "LIBRARY")).toBe(true);
  });

  it("stays silent when no soundtrack was chosen", () => {
    expect(playsAddedAudio("VIDEO", "MUTE", "NONE")).toBe(false);
  });
});

describe("mutesOriginalAudio", () => {
  it("mutes only a video whose original sound was dropped", () => {
    expect(mutesOriginalAudio("VIDEO", "MUTE")).toBe(true);
    expect(mutesOriginalAudio("VIDEO", "OVERLAY")).toBe(false);
    expect(mutesOriginalAudio("IMAGE", "MUTE")).toBe(false);
  });
});

describe("loopWithin", () => {
  it("rewinds to the start of the window when the playhead runs past the end", () => {
    expect(loopWithin(21, 5, 20)).toBe(5);
  });

  it("snaps a playhead that loaded before the window", () => {
    expect(loopWithin(1, 5, 20)).toBe(5);
  });

  it("leaves an open-ended window alone", () => {
    expect(loopWithin(40, 5, null)).toBe(40);
  });
});

describe("storyAudioSrc", () => {
  it("prefers the structured audio URL and hides a KEEP track on video", () => {
    expect(storyAudioSrc(story())).toBe("https://cdn.example/marina.m4a");
    expect(storyAudioSrc(story({ originalAudioMode: "KEEP" }))).toBeNull();
  });
});

describe("storyVisualState", () => {
  it("keeps an image on the still and a pending video off the player", () => {
    expect(storyVisualState(story({ kind: "IMAGE", playbackStatus: "READY" }))).toBe("image");
    expect(storyVisualState(story({ playbackStatus: "PENDING" }))).toBe("preparing");
    expect(storyVisualState(story())).toBe("video");
  });
});

describe("reachablePlaybackUrl", () => {
  it("accepts only an absolute playlist", () => {
    expect(reachablePlaybackUrl("https://cdn.example/live/1/index.m3u8")).toBe(true);
    expect(reachablePlaybackUrl("/media/hls/live/1/index.m3u8")).toBe(false);
    expect(reachablePlaybackUrl(null)).toBe(false);
  });
});
