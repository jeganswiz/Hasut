import { MEDIA_POLICY_DEFAULTS, readMediaPolicy } from "./media-policy";

describe("readMediaPolicy", () => {
  it("keeps an older allow-list and adds iPhone photo and movie types", () => {
    const read = readMediaPolicy({
      avatarMaxBytes: 100,
      presignTtlSeconds: 30,
      allowedMimeTypes: ["image/jpeg", "image/png"],
    });
    expect(read.avatarMaxBytes).toBe(100);
    expect(read.allowedMimeTypes).toEqual(
      expect.arrayContaining(["image/jpeg", "image/heic", "image/heif", "video/quicktime"]),
    );
  });

  it("falls back to the defaults when the stored value is not a policy", () => {
    expect(readMediaPolicy(null).allowedMimeTypes).toEqual(MEDIA_POLICY_DEFAULTS.allowedMimeTypes);
  });
});
