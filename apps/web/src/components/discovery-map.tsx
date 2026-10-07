"use client";

import { OSM_MAP_ATTRIBUTION, advanceBasemapIndex } from "@hasut/config";
import type { DiscoveryMarker } from "@hasut/types";
import { diffDiscoveryMarkers } from "@hasut/utils";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { playlistIsReady } from "../lib/live-playlist";
import {
  allowPinAutoplay,
  browserPinSignals,
  intersectsViewport,
  pickPinPreviews,
} from "../lib/pin-playback";
import { profileRingClass, profileRingState } from "../lib/story-ring";

function youMarkerHtml(
  photoUrl: string | null,
  memberId: string | null,
  ringClass: string,
): string {
  const safe = photoUrl === null ? "" : photoUrl.replace(/"/g, "");
  const photo = safe.length > 0 ? `<img alt="" src="${safe}" />` : "<span>You</span>";
  const active = ringClass.length > 0;
  const href = memberId !== null && active ? `/stories/${memberId}` : "/story";
  const label = active ? "Watch your presence" : "Your presence";
  const ring = ringClass.length > 0 ? ` ${ringClass}` : "";
  const live = ringClass === "is-live" ? "<em>LIVE</em>" : "";
  return `<a class="discovery-self${ring}" href="${href}" aria-label="${label}">${photo}${live}</a>`;
}

function markerHtml(
  marker: DiscoveryMarker,
  selected: boolean,
  selfId: string | null,
  watchedStoryIds: readonly string[],
): string {
  const status = profileRingClass(
    profileRingState({
      live: marker.pinMediaKind === "LIVE",
      storyIds: marker.storyIds ?? [],
      watchedStoryIds,
    }),
  );
  const ring = status.length > 0 ? status : marker.ring === "available" ? "is-available" : "";
  const photo =
    marker.photoUrl !== null
      ? `<img alt="" src="${marker.photoUrl.replace(/"/g, "")}" />`
      : `<span>${marker.initials}</span>`;
  const preview =
    marker.previewHlsUrl !== null &&
    (marker.pinMediaKind === "LIVE" || marker.pinMediaKind === "VIDEO")
      ? `<video muted playsinline loop data-hls="${marker.previewHlsUrl.replace(/"/g, "")}" data-kind="${marker.pinMediaKind}"></video>`
      : "";
  const live = marker.pinMediaKind === "LIVE" ? `<em>LIVE</em>` : "";
  const you = marker.id === selfId ? `<span class="map-avatar-you">You</span>` : "";
  const label = selected ? `<strong>${marker.label}</strong>` : "";
  return `<button class="map-avatar-pin ${ring}${marker.id === selfId ? " is-you" : ""}" type="button">${photo}${preview}${live}${you}${label}</button>`;
}

function uniqueTileChain(tileUrl: string, fallbackTileUrls: string[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of [tileUrl, ...fallbackTileUrls]) {
    if (url.length === 0 || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function DiscoveryMap({
  tileUrl,
  fallbackTileUrls = [],
  attribution = OSM_MAP_ATTRIBUTION,
  center,
  overlay,
  panCellId,
  markers,
  selectedId,
  selfId = null,
  selfPhotoUrl = null,
  selfRingClass = "",
  watchedStoryIds = [],
  playPreviews = false,
  route = null,
  callout = null,
  onClearRoute,
  onLocate,
  onSelect,
}: {
  tileUrl: string;
  fallbackTileUrls?: string[];
  attribution?: string;
  center: { latitude: number; longitude: number } | null;
  overlay: { latitude: number; longitude: number } | null;
  panCellId: string | null;
  markers: DiscoveryMarker[];
  selectedId: string | null;
  selfId?: string | null;
  selfPhotoUrl?: string | null;
  selfRingClass?: string;
  watchedStoryIds?: readonly string[];
  playPreviews?: boolean;
  /** Road line as [longitude, latitude]. Drawn on every basemap, including fallbacks. */
  route?: Array<[number, number]> | null;
  /** Card drawn above the selected pin. Stays on the map while it moves. */
  callout?: ReactNode;
  onClearRoute: () => void;
  onLocate: () => void;
  onSelect: (id: string) => void;
}) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerLayers = useRef(new Map<string, import("leaflet").Marker>());
  const selfLayer = useRef<import("leaflet").Marker | null>(null);
  const routeLayers = useRef<Array<import("leaflet").Polyline>>([]);
  const pinPlayers = useRef<Array<{ destroy: () => void }>>([]);
  const readyPlaylists = useRef(new Set<string>());
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    caret: number;
    below: boolean;
  } | null>(null);
  const ready = tileUrl.length > 0 && center !== null;
  const tileKey = `${tileUrl}|${fallbackTileUrls.join("|")}|${attribution}`;

  const centerRef = useRef(center);
  centerRef.current = center;

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!ready || mapNode.current === null || mapRef.current !== null) {
      return;
    }
    const start = centerRef.current;
    if (start === null) {
      return;
    }
    let cancelled = false;
    const urls = uniqueTileChain(tileUrl, fallbackTileUrls);
    void import("leaflet").then((leaflet) => {
      if (cancelled || mapNode.current === null || mapRef.current !== null) {
        return;
      }
      const map = leaflet
        .map(mapNode.current, { zoomControl: false })
        .setView([start.latitude, start.longitude], 14);
      let index = 0;
      let advancing = false;
      const layer = leaflet.tileLayer(urls[0] ?? tileUrl, { attribution });
      layer.on("tileerror", () => {
        if (advancing) {
          return;
        }
        const next = advanceBasemapIndex(index, urls.length);
        if (next === null) {
          return;
        }
        advancing = true;
        index = next;
        const nextUrl = urls[index];
        if (nextUrl !== undefined) {
          layer.setUrl(nextUrl);
        }
        queueMicrotask(() => {
          advancing = false;
        });
      });
      layer.addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayers.current.clear();
      selfLayer.current = null;
    };
  }, [ready, tileKey]);

  useEffect(() => {
    const map = mapRef.current;
    const next = centerRef.current;
    if (!mapReady || map === null || next === null || panCellId === null) {
      return;
    }
    map.panTo([next.latitude, next.longitude]);
  }, [mapReady, panCellId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || map === null) {
      return;
    }
    void import("leaflet").then((leaflet) => {
      if (overlay === null) {
        if (selfLayer.current !== null) {
          map.removeLayer(selfLayer.current);
          selfLayer.current = null;
        }
        return;
      }
      if (selfLayer.current === null) {
        selfLayer.current = leaflet
          .marker([overlay.latitude, overlay.longitude], {
            icon: leaflet.divIcon({
              className: "discovery-self-wrap",
              html: youMarkerHtml(selfPhotoUrl, selfId, selfRingClass),
              iconSize: [48, 48],
              iconAnchor: [24, 24],
            }),
            zIndexOffset: 800,
          })
          .addTo(map);
        return;
      }
      selfLayer.current.setLatLng([overlay.latitude, overlay.longitude]);
      selfLayer.current.setIcon(
        leaflet.divIcon({
          className: "discovery-self-wrap",
          html: youMarkerHtml(selfPhotoUrl, selfId, selfRingClass),
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        }),
      );
    });
  }, [mapReady, overlay, selfRingClass, selfId, selfPhotoUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || map === null) {
      return;
    }
    void import("leaflet").then((leaflet) => {
      const diff = diffDiscoveryMarkers([...markerLayers.current.keys()], markers);
      for (const id of diff.remove) {
        const layer = markerLayers.current.get(id);
        if (layer !== undefined) {
          map.removeLayer(layer);
          markerLayers.current.delete(id);
        }
      }
      for (const marker of [...diff.add, ...diff.update]) {
        const selected = marker.id === selectedId;
        const icon = leaflet.divIcon({
          className: "map-pin-wrap",
          html: markerHtml(marker, selected, selfId, watchedStoryIds),
          iconSize: [selected ? 72 : 48, selected ? 88 : 48],
        });
        const existing = markerLayers.current.get(marker.id);
        if (existing === undefined) {
          const layer = leaflet
            .marker([marker.pinLat, marker.pinLng], { icon })
            .on("click", () => onSelectRef.current(marker.id))
            .addTo(map);
          markerLayers.current.set(marker.id, layer);
        } else {
          existing.setLatLng([marker.pinLat, marker.pinLng]);
          existing.setIcon(icon);
        }
      }
    });
  }, [mapReady, markers, selectedId, selfId, watchedStoryIds]);

  useEffect(() => {
    function destroyPlayers(): void {
      for (const player of pinPlayers.current) {
        player.destroy();
      }
      pinPlayers.current = [];
    }

    let cancelled = false;

    function attach(): void {
      destroyPlayers();
      if (
        document.hidden ||
        selectedId !== null ||
        !allowPinAutoplay(browserPinSignals(playPreviews)) ||
        mapNode.current === null
      ) {
        return;
      }
      const frame = mapNode.current.getBoundingClientRect();
      const videos = [...mapNode.current.querySelectorAll<HTMLVideoElement>("video[data-hls]")];
      const urls = [
        ...new Set(
          videos
            .map((video) => video.dataset.hls)
            .filter((url): url is string => url !== undefined && url.length > 0),
        ),
      ];
      void Promise.all(urls.map((url) => rememberReadyPlaylist(readyPlaylists.current, url))).then(
        () => {
          if (cancelled || mapNode.current === null) {
            return;
          }
          const chosen = new Set(
            pickPinPreviews(
              videos.map((video) => {
                const box = video.getBoundingClientRect();
                const url = video.dataset.hls ?? "";
                return {
                  kind: video.dataset.kind === "LIVE" ? "LIVE" : "VIDEO",
                  url,
                  inView: intersectsViewport(box, frame),
                  playlistReady: readyPlaylists.current.has(url),
                };
              }),
            ).map((candidate) => candidate.url),
          );
          void import("hls.js").then((mod) => {
            if (cancelled) {
              return;
            }
            const Hls = mod.default;
            for (const video of videos) {
              const url = video.dataset.hls;
              if (url === undefined || !chosen.has(url)) {
                continue;
              }
              video.muted = true;
              if (Hls.isSupported()) {
                const hls = new Hls({ maxBufferLength: 4, capLevelToPlayerSize: true });
                hls.loadSource(url);
                hls.attachMedia(video);
                pinPlayers.current.push({ destroy: () => hls.destroy() });
              } else {
                video.src = url;
              }
              void video.play().catch(() => undefined);
            }
          });
        },
      );
    }

    const timer = window.setTimeout(attach, 80);
    document.addEventListener("visibilitychange", attach);
    const map = mapRef.current;
    map?.on("moveend", attach);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", attach);
      map?.off("moveend", attach);
      destroyPlayers();
    };
  }, [mapReady, markers, selectedId, playPreviews]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || map === null) {
      return;
    }
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      if (cancelled || mapRef.current === null) {
        return;
      }
      for (const layer of routeLayers.current) {
        layer.remove();
      }
      routeLayers.current = [];
      if (route === null || route.length < 2) {
        return;
      }
      const latLngs = route.map(
        ([longitude, latitude]) => [latitude, longitude] as [number, number],
      );
      const casing = leaflet.polyline(latLngs, {
        className: "discovery-route-casing",
        weight: 8,
        interactive: false,
      });
      const line = leaflet.polyline(latLngs, {
        className: "discovery-route",
        weight: 5,
        interactive: false,
      });
      casing.addTo(map);
      line.addTo(map);
      routeLayers.current = [casing, line];
      map.fitBounds(line.getBounds(), { padding: [48, 48], maxZoom: 16 });
    });
    return () => {
      cancelled = true;
      for (const layer of routeLayers.current) {
        layer.remove();
      }
      routeLayers.current = [];
    };
  }, [mapReady, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || map === null) {
      return;
    }
    const visible = callout !== null;
    function place(): void {
      if (map === null || selectedId === null || !visible) {
        setAnchor(null);
        return;
      }
      const marker = markers.find((item) => item.id === selectedId);
      if (marker === undefined) {
        setAnchor(null);
        return;
      }
      const point = map.latLngToContainerPoint([marker.pinLat, marker.pinLng]);
      const size = map.getSize();
      const cardWidth = Math.min(340, size.x - 32);
      const half = cardWidth / 2;
      const x = Math.min(size.x - half - 16, Math.max(half + 16, point.x));
      const below = point.y < 300;
      setAnchor({ x, y: point.y, caret: point.x - x, below });
    }
    place();
    map.on("move", place);
    map.on("zoom", place);
    return () => {
      map.off("move", place);
      map.off("zoom", place);
    };
  }, [callout, mapReady, markers, selectedId]);

  const calloutStyle: CSSProperties = {
    left: anchor?.x ?? 0,
    top: anchor?.y ?? 0,
    ["--caret" as string]: `${anchor?.caret ?? 0}px`,
  };

  function zoomBy(delta: number): void {
    mapRef.current?.setZoom(mapRef.current.getZoom() + delta);
  }

  function focusHere(): void {
    const map = mapRef.current;
    const point = overlay ?? center;
    if (map !== null && point !== null) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.flyTo([point.latitude, point.longitude], Math.max(map.getZoom(), 15), {
        duration: reduce ? 0 : 0.45,
      });
    }
    onLocate();
  }

  const routeVisible = route !== null && route.length >= 2;

  return (
    <>
      <div ref={mapNode} className="discovery-map" />
      <div className="map-tools">
        {routeVisible ? (
          <button type="button" className="map-tool map-tool-clear" onClick={onClearRoute}>
            Clear route
          </button>
        ) : null}
        <button
          type="button"
          className="map-tool"
          aria-label="Current location"
          onClick={focusHere}
        >
          <LocateIcon />
        </button>
        <div className="map-zoom">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)}>
            <PlusIcon />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)}>
            <MinusIcon />
          </button>
        </div>
      </div>
      {anchor !== null && callout !== null ? (
        <div className={anchor.below ? "map-callout is-below" : "map-callout"} style={calloutStyle}>
          {callout}
        </div>
      ) : null}
    </>
  );
}

function LocateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 12h12" />
    </svg>
  );
}

async function rememberReadyPlaylist(ready: Set<string>, url: string): Promise<void> {
  if (ready.has(url)) {
    return;
  }
  try {
    if (await playlistIsReady(url)) {
      ready.add(url);
    }
  } catch {
    // Pin stays on the still avatar until the playlist exists.
  }
}
