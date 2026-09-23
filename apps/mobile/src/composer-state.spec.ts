import {
  captionFits,
  composerBudgetHint,
  imageStoryInput,
  initialVideoTrim,
  liveTitleReady,
  pickerDurationSeconds,
  overlayNeedsTrack,
  patronAudienceHint,
  pickCaptionColor,
  videoStoryInput,
} from "./composer-state";

describe("pickCaptionColor", () => {
  it("keeps a swatch from the composer palette and drops anything else", () => {
    expect(pickCaptionColor("#EAB308", ["#EAB308", "#FFFFFF"])).toBe("#EAB308");
    expect(pickCaptionColor("#123456", ["#EAB308"])).toBeNull();
  });
});

describe("captionFits", () => {
  it("uses the operator cap, not a hardcoded length", () => {
    expect(captionFits("ok", 2)).toBe(true);
    expect(captionFits("  too  ", 2)).toBe(false);
  });
});

describe("liveTitleReady", () => {
  it("requires a title before go live", () => {
    expect(liveTitleReady("  Shop  ")).toBe(true);
    expect(liveTitleReady("   ")).toBe(false);
  });
});

describe("patronAudienceHint", () => {
  it("warns when the member has no Patrons", () => {
    expect(patronAudienceHint(0)).toContain("no accepted connections");
    expect(patronAudienceHint(3)).toContain("accepted a connection");
  });
});

describe("imageStoryInput", () => {
  it("publishes a still with KEEP original audio and an optional library track", () => {
    expect(
      imageStoryInput({
        imageMediaId: "11111111-1111-4111-8111-111111111111",
        caption: "Rewiring",
        captionColor: "#EAB308",
        audience: "PATRONS",
        trackId: "track-1",
      }),
    ).toEqual({
      kind: "IMAGE",
      imageMediaId: "11111111-1111-4111-8111-111111111111",
      caption: "Rewiring",
      captionColor: "#EAB308",
      audience: "PATRONS",
      originalAudioMode: "KEEP",
      audio: { source: "LIBRARY", trackId: "track-1", startSeconds: 0, endSeconds: null },
    });
  });
});

describe("pickerDurationSeconds", () => {
  it("converts the picker millisecond duration to whole seconds", () => {
    expect(pickerDurationSeconds(18500)).toBe(19);
    expect(pickerDurationSeconds(400)).toBe(1);
  });
});

describe("initialVideoTrim", () => {
  it("caps the first window to the operator duration", () => {
    expect(initialVideoTrim(90, 60)).toEqual({ start: 0, end: 60 });
    expect(initialVideoTrim(12, 60)).toEqual({ start: 0, end: 12 });
  });
});

describe("overlayNeedsTrack", () => {
  it("requires a track only when layering over a video", () => {
    expect(overlayNeedsTrack("VIDEO", "OVERLAY", null)).toBe(true);
    expect(overlayNeedsTrack("VIDEO", "OVERLAY", "track-1")).toBe(false);
    expect(overlayNeedsTrack("IMAGE", "OVERLAY", null)).toBe(false);
    expect(overlayNeedsTrack("VIDEO", "MUTE", null)).toBe(false);
  });
});

describe("videoStoryInput", () => {
  it("stores trim and original-audio mode on a video story", () => {
    expect(
      videoStoryInput({
        videoMediaId: "11111111-1111-4111-8111-111111111111",
        caption: "Rewiring",
        captionColor: null,
        audience: "EVERYONE",
        trackId: null,
        originalAudioMode: "MUTE",
        trim: { start: 3, end: 18 },
      }),
    ).toMatchObject({
      kind: "VIDEO",
      videoMediaId: "11111111-1111-4111-8111-111111111111",
      originalAudioMode: "MUTE",
      trimStartSeconds: 3,
      trimEndSeconds: 18,
    });
  });
});

describe("composerBudgetHint", () => {
  it("reads the caps from configuration", () => {
    expect(composerBudgetHint({ maxActiveStories: 5, storyTtlHours: 24 })).toBe(
      "Up to 5 active stories, each for 24 hours.",
    );
  });
});
