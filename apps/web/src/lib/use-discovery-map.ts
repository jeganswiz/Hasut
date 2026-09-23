"use client";

import {
  HasutApiError,
  createHasutDiscoveryRealtimeClient,
  hasutErrorCode,
  parseDiscoveryPresenceUpdated,
  type HasutRealtimeClient,
} from "@hasut/api-client";
import { resolveRealtimeApiBaseUrl } from "@hasut/config";
import type {
  CategoryView,
  DiscoveryCard,
  DiscoveryKind,
  DiscoveryPolicyView,
  DiscoveryPreview,
  DiscoveryResult,
} from "@hasut/types";
import { DISCOVERY_PRESENCE_EVENT } from "@hasut/types";
import { mergePresenceMarker, shouldAcceptLocationFix, snapToGrid } from "@hasut/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { createWebApiClient } from "./api";
import { DEFAULT_DISCOVERY_KINDS } from "./discovery-chrome";
import { webTokenStorage } from "./token-storage";

type GpsState = "prompt" | "granted" | "denied" | "unavailable";
export type DiscoveryLoadState = "loading" | "empty" | "error" | "success";

export interface DiscoveryCoords {
  latitude: number;
  longitude: number;
}

export function useDiscoveryMapController() {
  const [policy, setPolicy] = useState<DiscoveryPolicyView | null>(null);
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [radiusMeters, setRadiusMeters] = useState<number | undefined>();
  const [verified, setVerified] = useState(false);
  const [available, setAvailable] = useState(false);
  const [kinds, setKinds] = useState<DiscoveryKind[]>([...DEFAULT_DISCOVERY_KINDS]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DiscoveryPreview | null>(null);
  const [gps, setGps] = useState<GpsState>("prompt");
  const [overlayCoords, setOverlayCoords] = useState<DiscoveryCoords | null>(null);
  const [acceptedCoords, setAcceptedCoords] = useState<DiscoveryCoords | null>(null);
  const [load, setLoad] = useState<DiscoveryLoadState>("loading");
  const [message, setMessage] = useState("Finding what’s nearby…");
  const [statusTick, setStatusTick] = useState(0);
  const [suggestions, setSuggestions] = useState<DiscoveryCard[]>([]);
  const [suggestionQuery, setSuggestionQuery] = useState("");

  const publishStatus = useCallback((text: string) => {
    setMessage(text);
    setStatusTick((value) => value + 1);
  }, []);

  const acceptedRef = useRef<DiscoveryCoords | null>(null);
  const acceptedAtRef = useRef<number | null>(null);
  const permissionGrantedRef = useRef(false);
  const searchGenRef = useRef(0);
  const resultRef = useRef<DiscoveryResult | null>(null);
  const realtimeRef = useRef<HasutRealtimeClient | null>(null);
  const [watchNonce, setWatchNonce] = useState(0);

  resultRef.current = result;

  const applyDemoArea = useCallback(
    (nextPolicy: DiscoveryPolicyView) => {
      const demo = { latitude: nextPolicy.demoLatitude, longitude: nextPolicy.demoLongitude };
      acceptedRef.current = demo;
      acceptedAtRef.current = Date.now();
      setOverlayCoords(demo);
      setAcceptedCoords(demo);
      publishStatus("Showing the seeded demo neighborhood.");
    },
    [publishStatus],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const client = createWebApiClient();
        const [nextPolicy, tree] = await Promise.all([
          client.getDiscoveryPolicy(),
          client.listCategories(),
        ]);
        if (cancelled) {
          return;
        }
        setPolicy(nextPolicy);
        setCategories(tree);
        setRadiusMeters((current) => current ?? nextPolicy.defaultRadiusMeters);
      } catch {
        if (!cancelled) {
          setLoad("error");
          publishStatus("Unable to load discovery configuration.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistLocation = useCallback(async (next: DiscoveryCoords, accuracyMeters?: number) => {
    const token = await webTokenStorage.getAccessToken();
    if (token === null) {
      return;
    }
    const client = createWebApiClient();
    try {
      if (!permissionGrantedRef.current) {
        await client.patchLocationPermission({ status: "GRANTED" });
        permissionGrantedRef.current = true;
      }
      await client.putMyLocation({
        latitude: next.latitude,
        longitude: next.longitude,
        accuracyMeters,
      });
      realtimeRef.current?.emit("presence.sync");
    } catch (error) {
      if (hasutErrorCode(error) === "RATE_LIMITED") {
        return;
      }
      if (error instanceof HasutApiError && error.envelope.success === false) {
        return;
      }
    }
  }, []);

  useEffect(() => {
    if (
      policy === null ||
      typeof navigator === "undefined" ||
      navigator.geolocation === undefined
    ) {
      if (policy !== null) {
        setGps("unavailable");
        applyDemoArea(policy);
      }
      return;
    }
    publishStatus("Getting your location…");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setGps("granted");
        setOverlayCoords(next);
        const accept = shouldAcceptLocationFix({
          previous: acceptedRef.current,
          next,
          lastAcceptedAtMs: acceptedAtRef.current,
          nowMs: Date.now(),
          significantMoveMeters: policy.significantMoveMeters,
          minUpdateIntervalSeconds: policy.minUpdateIntervalSeconds,
        });
        if (!accept) {
          return;
        }
        acceptedRef.current = next;
        acceptedAtRef.current = Date.now();
        setAcceptedCoords(next);
        void persistLocation(next, position.coords.accuracy);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGps("denied");
        } else {
          setGps("unavailable");
        }
        applyDemoArea(policy);
      },
      {
        enableHighAccuracy: true,
        timeout: policy.geolocationTimeoutMs,
        maximumAge: policy.minUpdateIntervalSeconds * 1000,
      },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [applyDemoArea, persistLocation, policy, watchNonce]);

  const searchNearby = useCallback(
    async (silent: boolean) => {
      if (acceptedCoords === null || policy === null) {
        return;
      }
      const generation = searchGenRef.current + 1;
      searchGenRef.current = generation;
      if (!silent) {
        setLoad("loading");
        publishStatus("Searching nearby…");
      }
      try {
        const client = createWebApiClient();
        const data =
          query.trim().length > 0
            ? await client.searchNearby({
                q: query.trim(),
                latitude: acceptedCoords.latitude,
                longitude: acceptedCoords.longitude,
                radiusMeters,
                categoryId,
                kinds: kinds.length === 0 ? undefined : kinds,
                verified: verified ? true : undefined,
                available: available ? true : undefined,
              })
            : await client.nearby({
                latitude: acceptedCoords.latitude,
                longitude: acceptedCoords.longitude,
                radiusMeters,
                categoryId,
                kinds: kinds.length === 0 ? undefined : kinds,
                verified: verified ? true : undefined,
                available: available ? true : undefined,
              });
        if (generation !== searchGenRef.current) {
          return;
        }
        setResult(data);
        if (data.items.length === 0) {
          setLoad("empty");
          publishStatus(
            "No nearby results in this area. Try a wider distance or another category.",
          );
          return;
        }
        setLoad("success");
        publishStatus(`${data.items.length} nearby results`);
      } catch (error) {
        if (generation !== searchGenRef.current) {
          return;
        }
        if (silent && resultRef.current !== null) {
          return;
        }
        setResult(null);
        setLoad("error");
        publishStatus(
          error instanceof HasutApiError
            ? error.message
            : "Network failure. Check your connection and try again.",
        );
      }
    },
    [acceptedCoords, available, categoryId, kinds, policy, query, radiusMeters, verified],
  );

  useEffect(() => {
    if (acceptedCoords === null || policy === null) {
      return;
    }
    const silent = resultRef.current !== null;
    const timer = window.setTimeout(() => {
      void searchNearby(silent);
    }, policy.searchDebounceMs);
    return () => window.clearTimeout(timer);
  }, [
    acceptedCoords,
    available,
    categoryId,
    kinds,
    policy,
    query,
    radiusMeters,
    searchNearby,
    verified,
  ]);

  useEffect(() => {
    const text = query.trim();
    if (text.length === 0 || acceptedCoords === null || policy === null) {
      setSuggestions([]);
      setSuggestionQuery("");
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void createWebApiClient()
        .searchNearby({
          q: text,
          latitude: acceptedCoords.latitude,
          longitude: acceptedCoords.longitude,
          radiusMeters,
          kinds: [...DEFAULT_DISCOVERY_KINDS],
        })
        .then((data) => {
          if (!cancelled) {
            setSuggestions(data.items);
            setSuggestionQuery(text);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
            setSuggestionQuery("");
          }
        });
    }, policy.searchDebounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [acceptedCoords, policy, query, radiusMeters]);

  useEffect(() => {
    if (policy === null || acceptedCoords === null) {
      return;
    }
    const timer = window.setInterval(() => {
      void searchNearby(true);
    }, policy.minUpdateIntervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [acceptedCoords, policy, searchNearby]);

  useEffect(() => {
    if (policy === null) {
      return;
    }
    let cancelled = false;
    void webTokenStorage.getAccessToken().then((token) => {
      if (cancelled || token === null || typeof window === "undefined") {
        return;
      }
      const realtime = createHasutDiscoveryRealtimeClient({
        baseUrl: resolveRealtimeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, window.location.origin),
        tokenStorage: webTokenStorage,
      });
      realtimeRef.current = realtime;
      void realtime.connect().then((socket) => {
        socket.on(DISCOVERY_PRESENCE_EVENT, (payload: unknown) => {
          const parsed = parseDiscoveryPresenceUpdated(payload);
          if (parsed === null) {
            return;
          }
          setResult((current) =>
            current === null
              ? current
              : { ...current, markers: mergePresenceMarker(current.markers, parsed.marker) },
          );
        });
        realtime.emit("presence.sync");
      });
    });
    return () => {
      cancelled = true;
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
    };
  }, [policy]);

  useEffect(() => {
    realtimeRef.current?.emit("presence.sync");
  }, [acceptedCoords]);

  useEffect(() => {
    if (selectedId === null || acceptedCoords === null || result === null) {
      setPreview(null);
      return;
    }
    const selected = result.items.find((item) => item.id === selectedId);
    if (selected === undefined) {
      setPreview(null);
      return;
    }
    void createWebApiClient()
      .getDiscoveryPreview(selected.kind, selected.id, {
        latitude: acceptedCoords.latitude,
        longitude: acceptedCoords.longitude,
        radiusMeters,
      })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [acceptedCoords, radiusMeters, result, selectedId]);

  const useDemoArea = useCallback(() => {
    if (policy === null) {
      return;
    }
    applyDemoArea(policy);
  }, [applyDemoArea, policy]);

  const locate = useCallback(() => {
    acceptedRef.current = null;
    acceptedAtRef.current = null;
    setGps("prompt");
    publishStatus("Getting your location…");
    setWatchNonce((current) => current + 1);
  }, []);

  function toggleKind(kind: DiscoveryKind): void {
    setKinds((current) =>
      current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind],
    );
  }

  const panCellId =
    acceptedCoords === null || policy === null
      ? null
      : snapToGrid(acceptedCoords, policy.clusterCellMeters).cellId;

  return {
    policy,
    categories,
    result,
    query,
    setQuery,
    categoryId,
    setCategoryId,
    radiusMeters,
    setRadiusMeters,
    verified,
    setVerified,
    available,
    setAvailable,
    kinds,
    toggleKind,
    selectedId,
    setSelectedId,
    preview,
    gps,
    overlayCoords,
    acceptedCoords,
    panCellId,
    load,
    message,
    statusTick,
    suggestions,
    suggestionQuery,
    useDemoArea,
    locate,
    searchNearby: () => void searchNearby(false),
  };
}
