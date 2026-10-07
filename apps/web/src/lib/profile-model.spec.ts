import {
  compactCount,
  connectionStats,
  formatOfferingPrice,
  groupOfferings,
  rankOfferings,
  ratingLabel,
  recordedLiveCards,
  relativeTime,
  serviceTabState,
  shareOrCopy,
  sortByCreatedAt,
  storyEngagement,
  trimmedDurationSeconds,
} from "./profile-model";

describe("profile model", () => {
  it("counts accepted patrons and incoming requests", () => {
    expect(
      connectionStats([
        { status: "ACCEPTED", direction: "INCOMING" },
        { status: "ACCEPTED", direction: "OUTGOING" },
        { status: "PENDING", direction: "INCOMING" },
        { status: "PENDING", direction: "OUTGOING" },
        { status: "REJECTED", direction: "INCOMING" },
      ]),
    ).toEqual({ patrons: 2, requests: 1 });
  });

  it("shows New until a review exists", () => {
    expect(ratingLabel(null, 0)).toBe("New");
    expect(ratingLabel(0, 0)).toBe("New");
    expect(ratingLabel(4.82, 3)).toBe("4.8");
  });

  it("compacts large counts", () => {
    expect(compactCount(32)).toBe("32");
    expect(compactCount(1200)).toBe("1.2K");
    expect(compactCount(12800)).toBe("13K");
  });

  it("labels recent presence times", () => {
    const now = Date.parse("2026-10-07T12:00:00.000Z");
    expect(relativeTime("2026-10-07T11:00:00.000Z", now)).toBe("1h ago");
    expect(relativeTime("2026-10-02T12:00:00.000Z", now)).toBe("5d ago");
  });

  it("reads a trim window and ignores an open-ended video", () => {
    expect(trimmedDurationSeconds(2, 26)).toBe(24);
    expect(trimmedDurationSeconds(0, null)).toBeNull();
  });

  it("derives views and likes from the owner viewer list", () => {
    expect(storyEngagement([{ liked: true }, { liked: false }, { liked: true }])).toEqual({
      views: 3,
      likes: 2,
    });
  });

  it("ranks used, then most reviewed, then highest rated, then the rest", () => {
    const ranked = rankOfferings([
      { id: "plain", used: false, reviewCount: null, rating: null, active: true },
      { id: "rated", used: false, reviewCount: 4, rating: 4.2, active: true },
      { id: "used", used: true, reviewCount: 1, rating: 3, active: true },
      { id: "reviewed", used: false, reviewCount: 12, rating: 4.9, active: false },
      { id: "paused", used: false, reviewCount: null, rating: null, active: false },
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["used", "reviewed", "rated", "plain", "paused"]);
    const groups = groupOfferings(ranked);
    expect(groups.used.map((item) => item.id)).toEqual(["used"]);
    expect(groups.reviewed.map((item) => item.id)).toEqual(["reviewed", "rated"]);
    expect(groups.rest.map((item) => item.id)).toEqual(["plain", "paused"]);
  });

  it("keeps API order when offerings have no review or booking signals", () => {
    expect(
      rankOfferings([
        { id: "a", used: false, reviewCount: null, rating: null, active: true },
        { id: "b", used: false, reviewCount: null, rating: null, active: true },
      ]).map((item) => item.id),
    ).toEqual(["a", "b"]);
  });

  it("chooses the services tab from onboarding", () => {
    expect(serviceTabState({ onboardingStatus: "NOT_STARTED", offeringCount: 0 })).toBe("upgrade");
    expect(serviceTabState({ onboardingStatus: null, offeringCount: 0 })).toBe("upgrade");
    expect(serviceTabState({ onboardingStatus: "DRAFT", offeringCount: 0 })).toBe("finish");
    expect(serviceTabState({ onboardingStatus: "ACTIVE", offeringCount: 0 })).toBe("empty");
    expect(serviceTabState({ onboardingStatus: "PAUSED", offeringCount: 2 })).toBe("list");
  });

  it("formats a price only when the offering has one", () => {
    expect(formatOfferingPrice(null, "INR")).toBeNull();
    expect(formatOfferingPrice(250, null)).toBe("250");
    expect(formatOfferingPrice(250, "INR")).toMatch(/250/);
  });

  it("hides live stories while a broadcast is active", () => {
    const stories = [
      {
        id: "live-1",
        kind: "LIVE",
        caption: "Market",
        imageUrl: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        trimStartSeconds: 0,
        trimEndSeconds: 90,
      },
      {
        id: "photo-1",
        kind: "IMAGE",
        caption: "Hill",
        imageUrl: "/hill.jpg",
        createdAt: "2026-10-02T00:00:00.000Z",
        trimStartSeconds: 0,
        trimEndSeconds: null,
      },
    ];
    expect(recordedLiveCards(stories, { status: "LIVE" })).toEqual([]);
    expect(recordedLiveCards(stories, null)).toEqual([
      {
        id: "live-1",
        title: "Market",
        thumbnailUrl: null,
        startedAt: "2026-10-01T00:00:00.000Z",
        durationSeconds: 90,
      },
    ]);
  });

  it("sorts presence newest first", () => {
    const items = [
      { createdAt: "2026-01-01T00:00:00.000Z" },
      { createdAt: "2026-02-01T00:00:00.000Z" },
    ];
    expect(sortByCreatedAt(items, "latest").map((item) => item.createdAt)[0]).toBe(
      "2026-02-01T00:00:00.000Z",
    );
    expect(sortByCreatedAt(items, "oldest")[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("shares when the browser can, and copies when it cannot", async () => {
    const writeText = jest.fn(async () => undefined);
    const share = jest.fn(async () => undefined);
    await expect(
      shareOrCopy({ url: "https://hasut.test/members/1", title: "Ada", share, writeText }),
    ).resolves.toBe("shared");
    expect(writeText).not.toHaveBeenCalled();

    await expect(
      shareOrCopy({
        url: "https://hasut.test/members/1",
        title: "Ada",
        share: async () => {
          const abort = new Error("dismissed");
          abort.name = "AbortError";
          throw abort;
        },
        writeText,
      }),
    ).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();

    await expect(
      shareOrCopy({ url: "https://hasut.test/members/1", title: "Ada", writeText }),
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://hasut.test/members/1");
  });
});
