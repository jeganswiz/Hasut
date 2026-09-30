"use client";

import { OSM_MAP_ATTRIBUTION, advanceBasemapIndex } from "@hasut/config";
import type { DiscoveryCluster, DiscoveryMarker } from "@hasut/types";
import { diffDiscoveryMarkers } from "@hasut/utils";
import { useEffect, useRef, useState } from "react";
import { isLivePlaylist } from "../lib/live-playlist";
import {
  allowPinAutoplay,
  browserPinSignals,
  intersectsViewport,
  pickPinPreviews,
} from "../lib/pin-playback";
import { hasStoryRing } from "../lib/story-ring";

function youMarkerHtml(
  photoUrl: string | null,
  memberId: string | null,
  hasStory: boolean,
): string {
  const safe = photoUrl === null ? "" : photoUrl.replace(/"/g, "");
  const photo = safe.length > 0 ? `<img alt="" src="${safe}" />` : "<span>You</span>";
  const href = memberId !== null && hasStory ? `/stories/${memberId}` : "/story";
  const label = hasStory ? "Watch your presence" : "Your presence";
  const ring = hasStory ? " has-story" : "";
  return `<a class="discovery-self${ring}" href="${href}" aria-label="${label}">${photo}</a>`;
}

function markerHtml(marker: DiscoveryMarker, selected: boolean, selfId: string | null): string {
  const story = hasStoryRing(marker.pinMediaKind);
  const ring = story
    ? "has-story"
    : marker.ring === "live"
      ? "is-live"
      : marker.ring === "available"
        ? "is-available"
        : "";
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
  clusters,
  selectedId,
  selfId = null,
  selfPhotoUrl = null,
  selfHasStory = false,
  playPreviews = false,
  onSelect,
}: {
  tileUrl: string;
  fallbackTileUrls?: string[];
  attribution?: string;
  center: { latitude: number; longitude: number } | null;
  overlay: { latitude: number; longitude: number } | null;
  panCellId: string | null;
  markers: DiscoveryMarker[];
  clusters: DiscoveryCluster[];
  selectedId: string | null;
  selfId?: string | null;
  selfPhotoUrl?: string | null;
  selfHasStory?: boolean;
  playPreviews?: boolean;
  onSelect: (id: string) => void;
}) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerLayers = useRef(new Map<string, import("leaflet").Marker>());
  const clusterLayers = useRef(new Map<string, import("leaflet").Marker>());
  const selfLayer = useRef<import("leaflet").Marker | null>(null);
  const pinPlayers = useRef<Array<{ destroy: () => void }>>([]);
  const readyPlaylists = useRef(new Set<string>());
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);
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
      clusterLayers.current.clear();
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
              html: youMarkerHtml(selfPhotoUrl, selfId, selfHasStory),
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
          className: "",
          html: youMarkerHtml(selfPhotoUrl, selfId, selfHasStory),
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          className: "discovery-self-wrap",
        }),
      );
    });
  }, [mapReady, overlay, selfHasStory, selfId, selfPhotoUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || map === null) {
      return;
    }
    void import("leaflet").then((leaflet) => {
      const visibleMarkers = markers.filter((marker) => {
        const clustered = clusters.some(
          (cluster) => cluster.pinLat === marker.pinLat && cluster.pinLng === marker.pinLng,
        );
        return !clustered || marker.id === selectedId;
      });
      const diff = diffDiscoveryMarkers([...markerLayers.current.keys()], visibleMarkers);
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
          html: markerHtml(marker, selected, selfId),
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

      const nextClusterIds = new Set(clusters.map((cluster) => cluster.id));
      for (const [id, layer] of clusterLayers.current) {
        if (!nextClusterIds.has(id)) {
          map.removeLayer(layer);
          clusterLayers.current.delete(id);
        }
      }
      for (const cluster of clusters) {
        const icon = leaflet.divIcon({
          className: "",
          html: `<div class="discovery-cluster">${cluster.count}</div>`,
          iconSize: [36, 36],
        });
        const existing = clusterLayers.current.get(cluster.id);
        if (existing === undefined) {
          clusterLayers.current.set(
            cluster.id,
            leaflet.marker([cluster.pinLat, cluster.pinLng], { icon }).addTo(map),
          );
        } else {
          existing.setLatLng([cluster.pinLat, cluster.pinLng]);
          existing.setIcon(icon);
        }
      }
    });
  }, [clusters, mapReady, markers, selectedId, selfId]);

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
  }, [clusters, mapReady, markers, selectedId, playPreviews]);

  return <div ref={mapNode} className="discovery-map" />;
}

async function rememberReadyPlaylist(ready: Set<string>, url: string): Promise<void> {
  if (ready.has(url)) {
    return;
  }
  try {
    const response = await fetch(url);
    const body = response.ok ? await response.text() : "";
    if (isLivePlaylist(response.status, body)) {
      ready.add(url);
    }
  } catch {
    // Pin stays on the still avatar until the playlist exists.
  }
}
