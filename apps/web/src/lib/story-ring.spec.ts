import { hasStoryRing } from "./story-ring";

describe("story ring", () => {
  it("marks an active story and leaves a plain profile unmarked", () => {
    expect(hasStoryRing("IMAGE")).toBe(true);
    expect(hasStoryRing("VIDEO")).toBe(true);
    expect(hasStoryRing("LIVE")).toBe(true);
    expect(hasStoryRing("PROFILE")).toBe(false);
    expect(hasStoryRing(null)).toBe(false);
  });
});
