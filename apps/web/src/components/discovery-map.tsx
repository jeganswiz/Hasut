"use client";

import type { DiscoveryCluster, DiscoveryMarker } from "@hasut/types";
import { useEffect, useRef, useState } from "react";

export function DiscoveryMap({
  tileUrl,
  center,
  markers,
  clusters,
  selectedId,
  onSelect,
}: {
  tileUrl: string;
  center: { latitude: number; longitude: number } | null;
  markers: DiscoveryMarker[];
  clusters: DiscoveryCluster[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (
      mapNode.current === null ||
      mapRef.current !== null ||
      center === null ||
      tileUrl.length === 0
    ) {
      return;
    }
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      if (cancelled || mapNode.current === null) {
        return;
      }
      const map = leaflet
        .map(mapNode.current, { zoomControl: false })
        .setView([center.latitude, center.longitude], 14);
      leaflet.tileLayer(tileUrl, { attribution: "&copy; OpenStreetMap" }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [center, tileUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || map === null || center === null) {
      return;
    }
    void import("leaflet").then((leaflet) => {
      map.eachLayer((layer) => {
        if (layer instanceof leaflet.Marker) {
          map.removeLayer(layer);
        }
      });
      for (const cluster of clusters) {
        leaflet
          .marker([cluster.pinLat, cluster.pinLng], {
            icon: leaflet.divIcon({
              className: "",
              html: `<div class="discovery-cluster">${cluster.count}</div>`,
              iconSize: [36, 36],
            }),
          })
          .addTo(map);
      }
      for (const marker of markers) {
        const selected = marker.id === selectedId;
        const clustered = clusters.some(
          (cluster) => cluster.pinLat === marker.pinLat && cluster.pinLng === marker.pinLng,
        );
        if (clustered && !selected) {
          continue;
        }
        leaflet
          .marker([marker.pinLat, marker.pinLng], {
            icon: leaflet.divIcon({
              className: "",
              html: `<button class="discovery-marker" type="button"><span>★</span> ${
                marker.rating === null ? "New" : marker.rating.toFixed(1)
              }${selected ? ` ${marker.label}` : ""}</button>`,
              iconSize: [selected ? 140 : 72, 32],
            }),
          })
          .on("click", () => onSelect(marker.id))
          .addTo(map);
      }
    });
  }, [center, clusters, mapReady, markers, onSelect, selectedId]);

  return <div ref={mapNode} className="discovery-map" />;
}
