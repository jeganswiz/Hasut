import {
  allowPinAutoplay,
  intersectsViewport,
  isHlsDocument,
  ownerPresenceCopy,
  pickPinPreviews,
  pinAutoplaySignalsFromNetwork,
  showPinPreviewControl,
} from "./pin-playback";

describe("pinAutoplaySignalsFromNetwork", () => {
  it("treats Expo CELLULAR as the same signal as the web connection type", () => {
    expect(pinAutoplaySignalsFromNetwork({ reducedMotion: false, type: "CELLULAR" })).toEqual({
      reducedMotion: false,
      saveData: undefined,
      type: "cellular",
      effectiveType: undefined,
    });
    expect(
      allowPinAutoplay(pinAutoplaySignalsFromNetwork({ reducedMotion: false, type: "WIFI" })),
    ).toBe(true);
    expect(
      allowPinAutoplay(pinAutoplaySignalsFromNetwork({ reducedMotion: false, type: "CELLULAR" })),
    ).toBe(false);
  });
});

describe("allowPinAutoplay", () => {
  it("plays on an unconstrained connection", () => {
    expect(allowPinAutoplay({ reducedMotion: false })).toBe(true);
  });

  it("stays still for data saver, cellular, and reduced motion", () => {
    expect(allowPinAutoplay({ reducedMotion: false, saveData: true })).toBe(false);
    expect(allowPinAutoplay({ reducedMotion: false, type: "cellular" })).toBe(false);
    expect(allowPinAutoplay({ reducedMotion: true })).toBe(false);
    expect(allowPinAutoplay({ reducedMotion: false, effectiveType: "2g" })).toBe(false);
  });

  it("lets the member opt in on cellular unless reduced motion is on", () => {
    expect(allowPinAutoplay({ reducedMotion: false, type: "cellular", explicitAllow: true })).toBe(
      true,
    );
    expect(allowPinAutoplay({ reducedMotion: true, type: "cellular", explicitAllow: true })).toBe(
      false,
    );
    expect(
      showPinPreviewControl({ reducedMotion: false, type: "cellular", explicitAllow: false }),
    ).toBe(true);
    expect(showPinPreviewControl({ reducedMotion: false })).toBe(false);
    expect(showPinPreviewControl({ reducedMotion: true, type: "cellular" })).toBe(false);
  });
});

describe("intersectsViewport", () => {
  const frame = { top: 0, right: 100, bottom: 100, left: 0 };

  it("rejects a pin that has scrolled off the map", () => {
    expect(intersectsViewport({ top: 120, right: 40, bottom: 140, left: 20 }, frame)).toBe(false);
  });

  it("keeps a pin that overlaps the map", () => {
    expect(intersectsViewport({ top: 80, right: 40, bottom: 140, left: 20 }, frame)).toBe(true);
  });
});

describe("pickPinPreviews", () => {
  it("prefers a live pin and caps concurrent decodes at three", () => {
    const picked = pickPinPreviews(
      [
        { kind: "VIDEO", url: "v1", inView: true, playlistReady: true },
        { kind: "VIDEO", url: "v2", inView: true, playlistReady: true },
        { kind: "LIVE", url: "live", inView: true, playlistReady: true },
        { kind: "VIDEO", url: "v3", inView: true, playlistReady: true },
        { kind: "VIDEO", url: "off", inView: false, playlistReady: true },
      ],
      3,
    );
    expect(picked.map((item) => item.url)).toEqual(["live", "v1", "v2"]);
  });

  it("skips a pin whose playlist is not ready yet", () => {
    const picked = pickPinPreviews(
      [
        { kind: "LIVE", url: "live", inView: true, playlistReady: false },
        { kind: "VIDEO", url: "v1", inView: true, playlistReady: true },
      ],
      3,
    );
    expect(picked.map((item) => item.url)).toEqual(["v1"]);
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

describe("isHlsDocument", () => {
  it("accepts an HLS playlist body", () => {
    expect(isHlsDocument(200, "#EXTM3U\n#EXT-X-VERSION:3\n")).toBe(true);
    expect(isHlsDocument(404, "#EXTM3U")).toBe(false);
    expect(isHlsDocument(200, "not a playlist")).toBe(false);
  });
});
