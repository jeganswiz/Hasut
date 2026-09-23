export interface PinPreviewCandidate {
  kind: "LIVE" | "VIDEO";
  url: string;
  inView: boolean;
  /** False until the playlist body is HLS. A 404 pin stays on the still avatar. */
  playlistReady: boolean;
}

export interface PinAutoplaySignals {
  reducedMotion: boolean;
  saveData?: boolean;
  type?: string;
  effectiveType?: string;
}

export interface LayoutBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Maps Expo / navigator connection strings onto the shared autoplay signals. */
export function pinAutoplaySignalsFromNetwork(input: {
  reducedMotion: boolean;
  type?: string | null;
  saveData?: boolean;
  effectiveType?: string | null;
}): PinAutoplaySignals {
  const type = input.type?.trim().toLowerCase();
  return {
    reducedMotion: input.reducedMotion,
    saveData: input.saveData,
    type: type === "cell" || type === "cellular" ? "cellular" : type,
    effectiveType: input.effectiveType ?? undefined,
  };
}

/** Cellular, data saver, and reduced motion stay on the still avatar. */
export function allowPinAutoplay(signals: PinAutoplaySignals): boolean {
  if (signals.reducedMotion || signals.saveData === true) {
    return false;
  }
  if (signals.type === "cellular") {
    return false;
  }
  const slow = signals.effectiveType;
  return slow !== "slow-2g" && slow !== "2g" && slow !== "3g";
}

export function intersectsViewport(box: LayoutBox, frame: LayoutBox): boolean {
  return (
    box.bottom > frame.top &&
    box.top < frame.bottom &&
    box.right > frame.left &&
    box.left < frame.right
  );
}

/** Live pins first, only those on screen, never more than `limit` decoders. */
export function pickPinPreviews(
  candidates: readonly PinPreviewCandidate[],
  limit = 3,
): PinPreviewCandidate[] {
  return candidates
    .filter((candidate) => candidate.inView && candidate.playlistReady && candidate.url.length > 0)
    .sort((left, right) => Number(right.kind === "LIVE") - Number(left.kind === "LIVE"))
    .slice(0, Math.max(0, limit));
}

export function isHlsDocument(status: number, body: string): boolean {
  return status === 200 && body.includes("#EXTM3U");
}

export const HLS_PLAYLIST_POLL_MS = 2000;
