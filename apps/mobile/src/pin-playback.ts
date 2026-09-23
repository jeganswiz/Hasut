import type { DiscoveryMarker, PinMediaKind } from "@hasut/types";
import {
  intersectsViewport,
  resolveMediaUrl,
  type LayoutBox,
  type PinPreviewCandidate,
} from "@hasut/utils";

export function pinPreviewKind(kind: PinMediaKind): "LIVE" | "VIDEO" | null {
  return kind === "LIVE" || kind === "VIDEO" ? kind : null;
}

export function pinPreviewUri(
  marker: Pick<DiscoveryMarker, "pinMediaKind" | "previewHlsUrl">,
  apiOrigin: string,
): string | null {
  if (pinPreviewKind(marker.pinMediaKind) === null) {
    return null;
  }
  return resolveMediaUrl(marker.previewHlsUrl, apiOrigin);
}

export function shouldAttachPinPreviews(input: {
  autoplay: boolean;
  sheetOpen: boolean;
  appActive: boolean;
}): boolean {
  return input.autoplay && input.appActive && !input.sheetOpen;
}

export function layoutBox(x: number, y: number, width: number, height: number): LayoutBox {
  return { top: y, right: x + width, bottom: y + height, left: x };
}

export function ownerPresenceCopy(signedIn: boolean, pinMediaKind: PinMediaKind | null): string {
  if (!signedIn) {
    return "";
  }
  if (pinMediaKind === null || pinMediaKind === "PROFILE") {
    return "Add a presence so neighbors see more than your profile.";
  }
  return "Your presence is on the map.";
}

export function pinPreviewCandidate(
  marker: Pick<DiscoveryMarker, "pinMediaKind" | "previewHlsUrl">,
  box: LayoutBox | null,
  frame: LayoutBox,
  readyUrls: ReadonlySet<string>,
  apiOrigin: string,
): PinPreviewCandidate | null {
  const kind = pinPreviewKind(marker.pinMediaKind);
  const url = pinPreviewUri(marker, apiOrigin);
  if (kind === null || url === null) {
    return null;
  }
  return {
    kind,
    url,
    inView: box !== null && intersectsViewport(box, frame),
    playlistReady: readyUrls.has(url),
  };
}
