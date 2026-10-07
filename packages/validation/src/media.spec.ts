import {
  MEDIA_UPLOAD_MAX_BYTES,
  STORY_MEDIA_MAX_BYTES,
  mediaPresignSchema,
  mediaUploadMaxBytes,
} from "./media";

describe("mediaUploadMaxBytes", () => {
  it("lets a story video exceed the small upload ceiling", () => {
    expect(mediaUploadMaxBytes("STORY_VIDEO")).toBe(STORY_MEDIA_MAX_BYTES);
    expect(mediaUploadMaxBytes("STORY_AUDIO")).toBe(STORY_MEDIA_MAX_BYTES);
    expect(mediaUploadMaxBytes("AVATAR")).toBe(MEDIA_UPLOAD_MAX_BYTES);
    expect(
      mediaPresignSchema.safeParse({
        purpose: "STORY_VIDEO",
        mimeType: "video/mp4",
        byteSize: MEDIA_UPLOAD_MAX_BYTES + 1,
      }).success,
    ).toBe(true);
    expect(
      mediaPresignSchema.safeParse({
        purpose: "AVATAR",
        mimeType: "image/jpeg",
        byteSize: MEDIA_UPLOAD_MAX_BYTES + 1,
      }).success,
    ).toBe(false);
  });
});
