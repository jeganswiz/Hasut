import type { DiscoveryMarker } from "@hasut/types";
import {
  layoutBox,
  ownerPresenceCopy,
  pinPreviewCandidate,
  pinPreviewKind,
  pinPreviewUri,
  shouldAttachPinPreviews,
} from "./pin-playback";

const API_ORIGIN = "http://localhost:3001";

function marker(overrides: Partial<DiscoveryMarker> = {}): DiscoveryMarker {
  return {
    id: "m1",
    kind: "MEMBER",
    label: "Priya",
    rating: null,
    selected: false,
    photoUrl: "https://cdn.example/p.jpg",
    initials: "PR",
    available: true,
    ring: "idle",
    pinLat: 13.08,
    pinLng: 80.27,
    pinMediaKind: "VIDEO",
    previewHlsUrl: "https://cdn.example/stories/s1/index.m3u8",
    ...overrides,
  };
}

describe("pinPreviewUri", () => {
  it("returns an absolute playlist only for live or video pins", () => {
    expect(pinPreviewUri(marker(), API_ORIGIN)).toBe("https://cdn.example/stories/s1/index.m3u8");
    expect(pinPreviewUri(marker({ pinMediaKind: "LIVE" }), API_ORIGIN)).toBe(
      "https://cdn.example/stories/s1/index.m3u8",
    );
    expect(pinPreviewUri(marker({ pinMediaKind: "IMAGE" }), API_ORIGIN)).toBeNull();
    expect(
      pinPreviewUri(marker({ previewHlsUrl: "/media/hls/stories/s1/index.m3u8" }), API_ORIGIN),
    ).toBe("http://localhost:3001/media/hls/stories/s1/index.m3u8");
  });
});

describe("pinPreviewKind", () => {
  it("ignores still pins", () => {
    expect(pinPreviewKind("PROFILE")).toBeNull();
    expect(pinPreviewKind("IMAGE")).toBeNull();
    expect(pinPreviewKind("LIVE")).toBe("LIVE");
  });
});

describe("pinPreviewCandidate", () => {
  const frame = layoutBox(0, 0, 100, 100);

  it("waits for a playlist and a pin that is on the map", () => {
    expect(
      pinPreviewCandidate(marker(), layoutBox(10, 10, 44, 44), frame, new Set(), API_ORIGIN),
    ).toEqual({
      kind: "VIDEO",
      url: "https://cdn.example/stories/s1/index.m3u8",
      inView: true,
      playlistReady: false,
    });
    expect(
      pinPreviewCandidate(
        marker(),
        layoutBox(10, 10, 44, 44),
        frame,
        new Set(["https://cdn.example/stories/s1/index.m3u8"]),
        API_ORIGIN,
      )?.playlistReady,
    ).toBe(true);
    expect(
      pinPreviewCandidate(marker(), layoutBox(0, 200, 44, 44), frame, new Set(), API_ORIGIN),
    ).toMatchObject({
      inView: false,
    });
  });
});

describe("ownerPresenceCopy", () => {
  it("prompts the owner when their pin is still the profile", () => {
    expect(ownerPresenceCopy(false, "PROFILE")).toBe("");
    expect(ownerPresenceCopy(true, null)).toBe(
      "Add a presence so neighbors see more than your profile.",
    );
    expect(ownerPresenceCopy(true, "PROFILE")).toBe(
      "Add a presence so neighbors see more than your profile.",
    );
    expect(ownerPresenceCopy(true, "IMAGE")).toBe("Your presence is on the map.");
    expect(ownerPresenceCopy(true, "LIVE")).toBe("Your presence is on the map.");
  });
});

describe("shouldAttachPinPreviews", () => {
  it("stays still when the sheet is open or the app is backgrounded", () => {
    expect(shouldAttachPinPreviews({ autoplay: true, sheetOpen: false, appActive: true })).toBe(
      true,
    );
    expect(shouldAttachPinPreviews({ autoplay: true, sheetOpen: true, appActive: true })).toBe(
      false,
    );
    expect(shouldAttachPinPreviews({ autoplay: true, sheetOpen: false, appActive: false })).toBe(
      false,
    );
    expect(shouldAttachPinPreviews({ autoplay: false, sheetOpen: false, appActive: true })).toBe(
      false,
    );
  });
});
