import { acceptedAvatarType } from "./profile-photo";

describe("profile photo", () => {
  it("accepts still images for an avatar", () => {
    expect(acceptedAvatarType("image/jpeg")).toBe(true);
    expect(acceptedAvatarType("image/png")).toBe(true);
    expect(acceptedAvatarType("image/webp")).toBe(true);
  });

  it("rejects video and empty types", () => {
    expect(acceptedAvatarType("video/mp4")).toBe(false);
    expect(acceptedAvatarType("")).toBe(false);
  });
});
