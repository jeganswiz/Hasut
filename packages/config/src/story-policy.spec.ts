import { STORY_POLICY_DEFAULTS, isStoryPolicy, readStoryPolicy } from "./story-policy";

describe("isStoryPolicy", () => {
  it("accepts the seeded default policy", () => {
    expect(isStoryPolicy(STORY_POLICY_DEFAULTS)).toBe(true);
  });

  it("rejects a palette that is not hex", () => {
    expect(isStoryPolicy({ ...STORY_POLICY_DEFAULTS, captionColors: ["red"] })).toBe(false);
  });

  it("keeps an older palette when the stored policy has no abuse caps yet", () => {
    const read = readStoryPolicy({
      ...STORY_POLICY_DEFAULTS,
      storyTtlHours: undefined,
      maxActiveStories: undefined,
      maxStoriesPerHour: undefined,
      maxLiveStartsPerHour: undefined,
      captionColors: ["#112233"],
    });
    expect(read.captionColors).toEqual(["#112233"]);
    expect(read.maxActiveStories).toBe(STORY_POLICY_DEFAULTS.maxActiveStories);
  });
});
