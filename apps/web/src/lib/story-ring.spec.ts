import {
  buildStoryTray,
  hasStoryRing,
  markStoryWatched,
  profileRingState,
  readWatchedStoryIds,
  storyWatchHoldMs,
} from "./story-ring";

describe("story ring", () => {
  it("marks an active story and leaves a plain profile unmarked", () => {
    expect(hasStoryRing("IMAGE")).toBe(true);
    expect(hasStoryRing("VIDEO")).toBe(true);
    expect(hasStoryRing("LIVE")).toBe(true);
    expect(hasStoryRing("PROFILE")).toBe(false);
    expect(hasStoryRing(null)).toBe(false);
  });

  it("uses the trim window for the watch sweep, otherwise one short pass", () => {
    expect(storyWatchHoldMs(0, 8)).toBe(8000);
    expect(storyWatchHoldMs(2, 2)).toBe(5000);
    expect(storyWatchHoldMs(0, null)).toBe(5000);
  });

  it("follows live, then unwatched stories, then a fully watched story, then no ring", () => {
    const stories = ["story-1", "story-2", "story-3"];
    expect(profileRingState({ live: false, storyIds: [], watchedStoryIds: [] })).toBe("none");
    expect(profileRingState({ live: true, storyIds: stories, watchedStoryIds: [] })).toBe("live");
    expect(profileRingState({ live: true, storyIds: stories, watchedStoryIds: stories })).toBe(
      "live",
    );
    expect(
      profileRingState({ live: false, storyIds: stories, watchedStoryIds: ["story-1", "story-2"] }),
    ).toBe("unseen");
    expect(profileRingState({ live: false, storyIds: stories, watchedStoryIds: stories })).toBe(
      "seen",
    );
    expect(profileRingState({ live: false, storyIds: [], watchedStoryIds: stories })).toBe("none");
  });

  it("remembers a watched story on this browser", () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saved.set(key, value);
      },
    };
    expect(readWatchedStoryIds(storage)).toEqual([]);
    markStoryWatched(storage, "member-1");
    markStoryWatched(storage, "member-1");
    expect(readWatchedStoryIds(storage)).toEqual(["member-1"]);
  });

  it("puts the signed-in member first and keeps other active stories", () => {
    const tray = buildStoryTray({
      selfId: "me",
      selfLabel: "You",
      selfImageUrl: "/me.jpg",
      selfKind: "IMAGE",
      faces: [
        { memberId: "me", label: "You again", imageUrl: null, kind: "IMAGE" },
        { memberId: "ada", label: "Ada", imageUrl: "/ada.jpg", kind: "VIDEO" },
      ],
    });
    expect(tray.map((face) => face.memberId)).toEqual(["me", "ada"]);
    expect(tray[0]?.self).toBe(true);
  });
});
