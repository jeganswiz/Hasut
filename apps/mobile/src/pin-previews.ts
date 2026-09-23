import type { DiscoveryMarker } from "@hasut/types";
import {
  HLS_PLAYLIST_POLL_MS,
  allowPinAutoplay,
  isHlsDocument,
  pickPinPreviews,
  pinAutoplaySignalsFromNetwork,
  type LayoutBox,
} from "@hasut/utils";
import { useNetworkState } from "expo-network";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import {
  layoutBox,
  pinPreviewCandidate,
  pinPreviewUri,
  shouldAttachPinPreviews,
} from "./pin-playback";

function readConnectionSignals(): { saveData?: boolean; type?: string; effectiveType?: string } {
  const connection = (
    globalThis as {
      navigator?: {
        connection?: { saveData?: boolean; type?: string; effectiveType?: string };
      };
    }
  ).navigator?.connection;
  return {
    saveData: connection?.saveData,
    type: connection?.type,
    effectiveType: connection?.effectiveType,
  };
}

function useReadyPlaylists(urls: readonly string[]): ReadonlySet<string> {
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  const key = urls.join("|");

  useEffect(() => {
    const list = key.length === 0 ? [] : key.split("|");
    if (list.length === 0) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const probe = (): void => {
      void Promise.all(
        list.map((url) =>
          fetch(url)
            .then(async (response) => {
              const body = response.ok ? await response.text() : "";
              return isHlsDocument(response.status, body) ? url : null;
            })
            .catch(() => null),
        ),
      ).then((found) => {
        if (cancelled) {
          return;
        }
        setReady((current) => {
          const merged = new Set(current);
          for (const url of found) {
            if (url !== null) {
              merged.add(url);
            }
          }
          return merged;
        });
        if (found.some((url) => url === null)) {
          timer = setTimeout(probe, HLS_PLAYLIST_POLL_MS);
        }
      });
    };
    probe();
    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [key]);

  return ready;
}

export function usePickedPinPreviewUrls(
  markers: readonly DiscoveryMarker[],
  pinBoxes: Readonly<Record<string, LayoutBox>>,
  mapSize: { width: number; height: number },
  sheetOpen: boolean,
  apiOrigin: string,
): ReadonlySet<string> {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const network = useNetworkState();
  const previewUrls = useMemo(
    () => [
      ...new Set(
        markers
          .map((marker) => pinPreviewUri(marker, apiOrigin))
          .filter((url): url is string => url !== null),
      ),
    ],
    [apiOrigin, markers],
  );
  const readyUrls = useReadyPlaylists(previewUrls);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) {
        setReducedMotion(value);
      }
    });
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    const app = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
    };
  }, []);

  return useMemo(() => {
    if (
      !shouldAttachPinPreviews({
        autoplay: allowPinAutoplay(
          pinAutoplaySignalsFromNetwork({
            reducedMotion,
            saveData: readConnectionSignals().saveData,
            effectiveType: readConnectionSignals().effectiveType,
            type: network.type ?? readConnectionSignals().type,
          }),
        ),
        sheetOpen,
        appActive,
      })
    ) {
      return new Set<string>();
    }
    const frame = layoutBox(0, 0, mapSize.width, mapSize.height);
    return new Set(
      pickPinPreviews(
        markers
          .map((marker) =>
            pinPreviewCandidate(marker, pinBoxes[marker.id] ?? null, frame, readyUrls, apiOrigin),
          )
          .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null),
      ).map((candidate) => candidate.url),
    );
  }, [
    appActive,
    mapSize.height,
    mapSize.width,
    markers,
    apiOrigin,
    network.type,
    pinBoxes,
    readyUrls,
    reducedMotion,
    sheetOpen,
  ]);
}
