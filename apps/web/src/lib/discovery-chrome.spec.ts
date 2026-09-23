import type { DiscoveryCard } from "@hasut/types";
import {
  CHROME_HEIGHT_MAX,
  CHROME_HEIGHT_MIN,
  DEFAULT_DISCOVERY_KINDS,
  buildSearchSuggestions,
  chromeScrollState,
  isDiscoveryAlert,
  nextToasts,
} from "./discovery-chrome";

function card(
  overrides: Partial<DiscoveryCard> & Pick<DiscoveryCard, "id" | "kind" | "title">,
): DiscoveryCard {
  return {
    subtitle: "",
    photoUrl: null,
    categoryLabel: null,
    rating: null,
    reviewCount: 0,
    distanceBucket: "1 km",
    verified: false,
    available: true,
    href: `/${overrides.kind.toLowerCase()}/${overrides.id}`,
    ...overrides,
  };
}

describe("discovery chrome", () => {
  it("starts people, professionals, and businesses selected", () => {
    expect(DEFAULT_DISCOVERY_KINDS).toEqual(["PROFESSIONAL", "BUSINESS", "MEMBER"]);
  });

  it("keeps the bar blurred and full height at the top of the map", () => {
    const state = chromeScrollState(0, 800);
    expect(state.height).toBe(CHROME_HEIGHT_MAX);
    expect(state.solid).toBe(false);
    expect(state.progress).toBe(0);
  });

  it("shrinks across the first half of the map and turns solid at the halfway point", () => {
    const midway = chromeScrollState(200, 800);
    expect(midway.solid).toBe(false);
    expect(midway.progress).toBeCloseTo(0.5);
    expect(midway.height).toBe(Math.round((CHROME_HEIGHT_MAX + CHROME_HEIGHT_MIN) / 2));

    const halfway = chromeScrollState(400, 800);
    expect(halfway.solid).toBe(true);
    expect(halfway.height).toBe(CHROME_HEIGHT_MIN);
  });

  it("uses a short page threshold when there is no map block", () => {
    expect(chromeScrollState(0, 0).solid).toBe(false);
    expect(chromeScrollState(40, 0).solid).toBe(true);
  });

  it("suggests services, professionals, businesses, and people", () => {
    const suggestions = buildSearchSuggestions({
      query: "p",
      categories: [{ id: "cat-1", name: "Plant care" }],
      items: [
        card({ id: "pro-1", kind: "PROFESSIONAL", title: "Plaza Studio", categoryLabel: "Design" }),
        card({ id: "biz-1", kind: "BUSINESS", title: "Plaza Cafe", subtitle: "Coffee" }),
        card({ id: "mem-1", kind: "MEMBER", title: "Pia Lopez", subtitle: "Nearby" }),
        card({ id: "skip", kind: "MEMBER", title: "Rohan Das" }),
      ],
    });
    expect(suggestions.map((item) => item.group)).toEqual([
      "Service",
      "Professionals",
      "Businesses",
      "People",
    ]);
    expect(suggestions.map((item) => item.label)).toEqual([
      "Plant care",
      "Plaza Studio",
      "Plaza Cafe",
      "Pia Lopez",
    ]);
  });

  it("keeps search matches whose service label is not repeated on the card", () => {
    const suggestions = buildSearchSuggestions({
      query: "inverter",
      prefiltered: true,
      categories: [],
      items: [
        card({
          id: "pro-1",
          kind: "PROFESSIONAL",
          title: "Arun Kumar",
          subtitle: "Wiring",
          categoryLabel: "Electrical",
        }),
      ],
    });
    expect(suggestions.map((item) => item.label)).toEqual(["Arun Kumar"]);
  });

  it("returns no suggestions for a blank query", () => {
    expect(
      buildSearchSuggestions({
        query: "   ",
        categories: [{ id: "cat-1", name: "Plant care" }],
        items: [],
      }),
    ).toEqual([]);
  });

  it("treats empty results and failures as toasts, and keeps progress copy quiet", () => {
    expect(
      isDiscoveryAlert(
        "empty",
        "No nearby results in this area. Try a wider distance or another category.",
      ),
    ).toBe(true);
    expect(isDiscoveryAlert("error", "Network failure. Check your connection and try again.")).toBe(
      true,
    );
    expect(isDiscoveryAlert("success", "Showing the seeded demo neighborhood.")).toBe(true);
    expect(isDiscoveryAlert("loading", "Searching nearby…")).toBe(false);
    expect(isDiscoveryAlert("success", "4 nearby results")).toBe(false);
  });

  it("refreshes a repeated alert instead of stacking copies", () => {
    const first = nextToasts([], "No nearby results", 1);
    const second = nextToasts(first, "No nearby results", 2);
    expect(second).toEqual([{ id: 2, text: "No nearby results" }]);
  });
});
