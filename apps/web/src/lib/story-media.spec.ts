import {
  audioMimeFor,
  classifyStoryFile,
  isHeicLike,
  keepsOriginalImage,
  videoMimeFor,
} from "./story-media";

describe("classifyStoryFile", () => {
  it("accepts iPhone photos even when the browser sends no type", () => {
    expect(classifyStoryFile({ name: "IMG_2043.HEIC", type: "" })).toBe("IMAGE");
    expect(isHeicLike({ name: "IMG_2043.HEIC", type: "" })).toBe(true);
    expect(classifyStoryFile({ name: "photo.heif", type: "application/octet-stream" })).toBe(
      "IMAGE",
    );
    expect(isHeicLike({ name: "photo", type: "image/heic" })).toBe(true);
  });

  it("accepts the usual still formats and phone movies", () => {
    expect(classifyStoryFile({ name: "a.jpg", type: "image/jpeg" })).toBe("IMAGE");
    expect(classifyStoryFile({ name: "a.png", type: "" })).toBe("IMAGE");
    expect(classifyStoryFile({ name: "a.gif", type: "image/gif" })).toBe("IMAGE");
    expect(classifyStoryFile({ name: "a.avif", type: "" })).toBe("IMAGE");
    expect(classifyStoryFile({ name: "clip.MOV", type: "" })).toBe("VIDEO");
    expect(videoMimeFor({ name: "clip.MOV", type: "" })).toBe("video/quicktime");
    expect(classifyStoryFile({ name: "clip.mp4", type: "video/mp4" })).toBe("VIDEO");
  });

  it("refuses files that are not a photo or a video", () => {
    expect(classifyStoryFile({ name: "notes.pdf", type: "application/pdf" })).toBeNull();
    expect(keepsOriginalImage({ name: "IMG_1.HEIC", type: "" })).toBe(false);
    expect(keepsOriginalImage({ name: "a.png", type: "image/png" })).toBe(true);
    expect(audioMimeFor({ name: "song.wav", type: "" })).toBe("audio/wav");
    expect(audioMimeFor({ name: "song.m4a", type: "" })).toBe("audio/mp4");
  });
});
