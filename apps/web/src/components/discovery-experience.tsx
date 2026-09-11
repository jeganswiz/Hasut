"use client";

import { HasutApiError } from "@hasut/api-client";
import type {
  CategoryView,
  DiscoveryCard,
  DiscoveryKind,
  DiscoveryPolicyView,
  DiscoveryPreview,
  DiscoveryResult,
} from "@hasut/types";
import { BottomSheet, FilterChip, NearbyCard, SearchBar, ServiceCard } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "./app-nav";
import { createWebApiClient } from "../lib/api";
import { flattenCategories } from "../lib/categories";
import { DiscoveryMap } from "./discovery-map";

type GpsState = "prompt" | "granted" | "denied" | "unavailable";
type LoadState = "loading" | "empty" | "error" | "success";

export function DiscoveryExperience() {
  const [policy, setPolicy] = useState<DiscoveryPolicyView | null>(null);
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [radiusMeters, setRadiusMeters] = useState<number | undefined>();
  const [verified, setVerified] = useState(false);
  const [available, setAvailable] = useState(false);
  const [kinds, setKinds] = useState<DiscoveryKind[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DiscoveryPreview | null>(null);
  const [gps, setGps] = useState<GpsState>("prompt");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [load, setLoad] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Finding what’s nearby…");

  const loadPolicy = useCallback(async () => {
    const client = createWebApiClient();
    const [nextPolicy, tree] = await Promise.all([
      client.getDiscoveryPolicy(),
      client.listCategories(),
    ]);
    setPolicy(nextPolicy);
    setCategories(tree);
    setRadiusMeters((current) => current ?? nextPolicy.defaultRadiusMeters);
  }, []);

  const useDemoArea = useCallback(() => {
    if (policy === null) {
      return;
    }
    setCoords({ latitude: policy.demoLatitude, longitude: policy.demoLongitude });
    setLoad("loading");
    setMessage("Showing the seeded demo neighborhood.");
  }, [policy]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGps("unavailable");
      useDemoArea();
      return;
    }
    setLoad("loading");
    setMessage("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps("granted");
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGps("denied");
        } else {
          setGps("unavailable");
        }
        useDemoArea();
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }, [useDemoArea]);

  const searchNearby = useCallback(async () => {
    if (coords === null || policy === null) {
      return;
    }
    setLoad("loading");
    setMessage("Searching nearby…");
    try {
      const client = createWebApiClient();
      const data =
        query.trim().length > 0
          ? await client.searchNearby({
              q: query.trim(),
              latitude: coords.latitude,
              longitude: coords.longitude,
              radiusMeters,
              categoryId,
              kinds: kinds.length === 0 ? undefined : kinds,
              verified: verified ? true : undefined,
              available: available ? true : undefined,
            })
          : await client.nearby({
              latitude: coords.latitude,
              longitude: coords.longitude,
              radiusMeters,
              categoryId,
              kinds: kinds.length === 0 ? undefined : kinds,
              verified: verified ? true : undefined,
              available: available ? true : undefined,
            });
      setResult(data);
      if (data.items.length === 0) {
        setLoad("empty");
        setMessage("No nearby results in this area. Try a wider distance or another category.");
        return;
      }
      setLoad("success");
      setMessage(`${data.items.length} nearby results`);
    } catch (error) {
      setResult(null);
      setLoad("error");
      if (error instanceof HasutApiError) {
        setMessage(error.message);
        return;
      }
      setMessage("Network failure. Check your connection and try again.");
    }
  }, [available, categoryId, coords, kinds, policy, query, radiusMeters, verified]);

  useEffect(() => {
    void loadPolicy().catch(() => {
      setLoad("error");
      setMessage("Unable to load discovery configuration.");
    });
    locate();
  }, [loadPolicy, locate]);

  useEffect(() => {
    if (coords !== null || policy === null) {
      return;
    }
    if (gps === "denied" || gps === "unavailable") {
      useDemoArea();
    }
  }, [coords, gps, policy, useDemoArea]);

  useEffect(() => {
    if (coords !== null && policy !== null) {
      void searchNearby();
    }
  }, [coords, policy, searchNearby]);

  useEffect(() => {
    if (selectedId === null || coords === null || result === null) {
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
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusMeters,
      })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [coords, radiusMeters, result, selectedId]);

  const selected = result?.items.find((item) => item.id === selectedId) ?? null;
  const cards = result?.items ?? [];
  const services = result?.items.filter((item) => item.kind === "PROFESSIONAL") ?? [];

  function toggleKind(kind: DiscoveryKind): void {
    setKinds((current) =>
      current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind],
    );
  }

  return (
    <div className="discovery-shell">
      <DiscoveryMap
        tileUrl={policy?.mapTileUrl ?? ""}
        center={coords}
        markers={result?.markers ?? []}
        clusters={result?.clusters ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <div className="discovery-overlay">
        <div className="discovery-top">
          <AppNav />
          <SearchBar
            placeholder="Search service"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void searchNearby();
              }
            }}
          />
          <p className="discovery-status">{message}</p>
          <div className="discovery-filters">
            {(policy?.radiusOptionsMeters ?? []).map((option) => (
              <FilterChip
                key={option}
                active={radiusMeters === option}
                onClick={() => setRadiusMeters(option)}
              >
                {option >= 1000 ? `${option / 1000}km` : `${option}m`}
              </FilterChip>
            ))}
            <FilterChip
              active={kinds.includes("PROFESSIONAL")}
              onClick={() => toggleKind("PROFESSIONAL")}
            >
              Professionals
            </FilterChip>
            <FilterChip active={kinds.includes("BUSINESS")} onClick={() => toggleKind("BUSINESS")}>
              Businesses
            </FilterChip>
            {policy?.includeMembers === true ? (
              <FilterChip active={kinds.includes("MEMBER")} onClick={() => toggleKind("MEMBER")}>
                People
              </FilterChip>
            ) : null}
            <FilterChip active={verified} onClick={() => setVerified((value) => !value)}>
              Verified
            </FilterChip>
            <FilterChip active={available} onClick={() => setAvailable((value) => !value)}>
              Available
            </FilterChip>
            <FilterChip
              active={
                coords !== null &&
                policy !== null &&
                coords.latitude === policy.demoLatitude &&
                coords.longitude === policy.demoLongitude
              }
              onClick={() => useDemoArea()}
            >
              Seeded area
            </FilterChip>
            {flattenCategories(categories).map((category) => (
              <FilterChip
                key={category.id}
                active={categoryId === category.id}
                onClick={() =>
                  setCategoryId((current) => (current === category.id ? undefined : category.id))
                }
              >
                {category.name}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="discovery-sheet">
          <BottomSheet>
            {gps === "denied" || gps === "unavailable" ? (
              <p>
                <button type="button" onClick={locate}>
                  Retry location
                </button>
              </p>
            ) : null}
            {load === "error" ? (
              <p>
                <button type="button" onClick={() => void searchNearby()}>
                  Retry search
                </button>
              </p>
            ) : null}
            {selected !== null ? <PreviewCard item={selected} preview={preview} /> : null}
            <div className="discovery-row">
              {cards.map((item) => (
                <NearbyCard
                  key={`${item.kind}-${item.id}`}
                  active={item.id === selectedId}
                  title={item.title}
                  rating={item.rating}
                  distance={item.distanceBucket}
                  onClick={() => setSelectedId(item.id)}
                />
              ))}
            </div>
            <div className="discovery-row">
              {services.map((item) => (
                <ServiceCard
                  key={`service-${item.id}`}
                  title={item.title}
                  categoryLabel={item.categoryLabel}
                  rating={item.rating}
                  photoUrl={item.photoUrl}
                  providerName={item.subtitle}
                  onOpen={() => {
                    window.location.assign(item.href);
                  }}
                />
              ))}
            </div>
          </BottomSheet>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ item, preview }: { item: DiscoveryCard; preview: DiscoveryPreview | null }) {
  const title = preview?.title ?? item.title;
  const subtitle = preview?.subtitle ?? item.subtitle;
  const location = preview?.approximateLocation?.label;
  return (
    <div className="discovery-preview">
      <h2 style={{ margin: "0 0 8px" }}>{title}</h2>
      <p style={{ margin: "0 0 8px" }}>{subtitle}</p>
      {location !== undefined ? <p>{location}</p> : null}
      <p>
        {preview?.distanceBucket ?? item.distanceBucket}
        {(preview?.verified ?? item.verified) ? " · Verified" : ""}
        {(preview?.available ?? item.available) ? " · Available" : ""}
      </p>
      <p>
        <a href={preview?.href ?? item.href}>Open full profile</a>
      </p>
    </div>
  );
}
