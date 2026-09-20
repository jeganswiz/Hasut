import { STORY_POLICY_DEFAULTS, isStoryPolicy } from "./story-policy";

describe("isStoryPolicy", () => {
  it("accepts the seeded default policy", () => {
    expect(isStoryPolicy(STORY_POLICY_DEFAULTS)).toBe(true);
  });

  it("rejects a palette that is not hex", () => {
    expect(isStoryPolicy({ ...STORY_POLICY_DEFAULTS, captionColors: ["red"] })).toBe(false);
  });

  it("rejects a missing library switch", () => {
    const { audioLibraryEnabled: _drop, ...rest } = STORY_POLICY_DEFAULTS;
    expect(isStoryPolicy(rest)).toBe(false);
  });
});
