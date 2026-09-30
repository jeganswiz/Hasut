import {
  allowPinAutoplay,
  intersectsViewport,
  pickPinPreviews,
  PIN_PREVIEW_OVERRIDE_KEY,
  readPinPreviewOverride,
  writePinPreviewOverride,
} from "./pin-playback";

describe("allowPinAutoplay", () => {
  it("plays on an unconstrained connection", () => {
    expect(allowPinAutoplay({ reducedMotion: false })).toBe(true);
  });

  it("stays still for data saver, cellular, and reduced motion", () => {
    expect(allowPinAutoplay({ reducedMotion: false, saveData: true })).toBe(false);
    expect(allowPinAutoplay({ reducedMotion: false, type: "cellular" })).toBe(false);
    expect(allowPinAutoplay({ reducedMotion: true })).toBe(false);
    expect(allowPinAutoplay({ reducedMotion: false, effectiveType: "2g" })).toBe(false);
    expect(allowPinAutoplay({ reducedMotion: false, type: "cellular", explicitAllow: true })).toBe(
      true,
    );
  });
});

describe("pin preview override", () => {
  it("stores a session opt-in without throwing when storage is missing", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    expect(readPinPreviewOverride(storage)).toBe(false);
    writePinPreviewOverride(storage, true);
    expect(store.get(PIN_PREVIEW_OVERRIDE_KEY)).toBe("1");
    writePinPreviewOverride(storage, false);
    expect(readPinPreviewOverride(storage)).toBe(false);
    writePinPreviewOverride(null, true);
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
