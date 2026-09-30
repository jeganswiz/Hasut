export {
  allowPinAutoplay,
  intersectsViewport,
  pickPinPreviews,
  showPinPreviewControl,
} from "@hasut/utils";
export type { PinAutoplaySignals, PinPreviewCandidate } from "@hasut/utils";

export const PIN_PREVIEW_OVERRIDE_KEY = "hasut.pin-preview-override";

export function readPinPreviewOverride(storage: Pick<Storage, "getItem"> | null): boolean {
  if (storage === null) {
    return false;
  }
  try {
    return storage.getItem(PIN_PREVIEW_OVERRIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writePinPreviewOverride(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  allowed: boolean,
): void {
  if (storage === null) {
    return;
  }
  try {
    if (allowed) {
      storage.setItem(PIN_PREVIEW_OVERRIDE_KEY, "1");
    } else {
      storage.removeItem(PIN_PREVIEW_OVERRIDE_KEY);
    }
  } catch {
    // Private mode can refuse sessionStorage.
  }
}

export function browserPinSignals(
  explicitAllow: boolean,
): import("@hasut/utils").PinAutoplaySignals {
  if (typeof window === "undefined") {
    return { reducedMotion: false, explicitAllow };
  }
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; type?: string; effectiveType?: string };
    }
  ).connection;
  return {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: connection?.saveData,
    type: connection?.type,
    effectiveType: connection?.effectiveType,
    explicitAllow,
  };
}
