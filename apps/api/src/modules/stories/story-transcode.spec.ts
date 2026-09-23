import { buildStoryTranscodePlan, type StoryTranscodeRecipe } from "./story-transcode";

function recipe(overrides: Partial<StoryTranscodeRecipe> = {}): StoryTranscodeRecipe {
  return {
    videoPath: "C:/tmp/video.bin",
    trimStartSeconds: 3,
    trimEndSeconds: 18,
    originalAudioMode: "KEEP",
    addedAudioPath: null,
    audioStartSeconds: 0,
    audioEndSeconds: null,
    playlistPath: "C:/tmp/out/index.m3u8",
    ...overrides,
  };
}

describe("buildStoryTranscodePlan", () => {
  it("trims the video and keeps the camera audio at 240p", () => {
    const args = buildStoryTranscodePlan(recipe());
    expect(args).toEqual(
      expect.arrayContaining(["-ss", "3", "-t", "15", "-i", "C:/tmp/video.bin", "-map", "0:a:0?"]),
    );
    expect(args).toContain("scale=-2:240");
    expect(args.at(-1)).toBe("C:/tmp/out/index.m3u8");
    expect(args).toContain("C:/tmp/out/seg_%03d.ts");
  });

  it("drops the camera audio when the member muted it and added nothing", () => {
    const args = buildStoryTranscodePlan(recipe({ originalAudioMode: "MUTE" }));
    expect(args).toContain("-an");
    expect(args).not.toContain("0:a:0?");
  });

  it("replaces the camera audio with the chosen window", () => {
    const args = buildStoryTranscodePlan(
      recipe({
        originalAudioMode: "MUTE",
        addedAudioPath: "C:/tmp/track.bin",
        audioStartSeconds: 5,
        audioEndSeconds: 20,
      }),
    );
    expect(args).toEqual(
      expect.arrayContaining(["-ss", "5", "-t", "15", "-i", "C:/tmp/track.bin", "-map", "1:a:0"]),
    );
    expect(args).toContain("-shortest");
    expect(args).not.toContain("-an");
  });

  it("mixes the camera audio with the chosen window", () => {
    const args = buildStoryTranscodePlan(
      recipe({ originalAudioMode: "OVERLAY", addedAudioPath: "C:/tmp/track.bin" }),
    );
    expect(args.some((arg) => arg.includes("amix="))).toBe(true);
    expect(args).not.toContain("scale=-2:240");
    expect(args.some((arg) => arg.includes("scale=-2:240"))).toBe(true);
  });

  it("ignores a stored track when the member kept the original", () => {
    const args = buildStoryTranscodePlan(
      recipe({ originalAudioMode: "KEEP", addedAudioPath: "C:/tmp/private-track.bin" }),
    );
    expect(args.join(" ")).not.toContain("private-track");
  });

  it("never puts caption text on the command line", () => {
    const args = buildStoryTranscodePlan(recipe());
    expect(args.join(" ")).not.toContain("caption");
  });

  it("refuses a playlist path that is not index.m3u8", () => {
    expect(() =>
      buildStoryTranscodePlan(recipe({ playlistPath: "C:/tmp/out/preview.m3u8" })),
    ).toThrow("index.m3u8");
  });
});
