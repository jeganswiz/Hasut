"use client";

import type { DiscoveryCard, DiscoveryPreview } from "@hasut/types";
import { BottomSheet, FilterChip, NearbyCard, ServiceCard } from "@hasut/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { flattenCategories } from "../lib/categories";
import {
  buildSearchSuggestions,
  isDiscoveryAlert,
  nextToasts,
  type SearchSuggestion,
  type ToastNote,
} from "../lib/discovery-chrome";
import { useDiscoveryMapController } from "../lib/use-discovery-map";
import { AppNav } from "./app-nav";
import { DiscoveryMap } from "./discovery-map";
import { NativeScroller } from "./native-scroller";
import { SearchSuggest } from "./search-suggest";
import { ToastStack } from "./toast-stack";

export function DiscoveryExperience() {
  const discovery = useDiscoveryMapController();
  const [toasts, setToasts] = useState<ToastNote[]>([]);
  const toastTimers = useRef<number[]>([]);
  const selected = discovery.result?.items.find((item) => item.id === discovery.selectedId) ?? null;
  const cards = discovery.result?.items ?? [];
  const services = discovery.result?.items.filter((item) => item.kind === "PROFESSIONAL") ?? [];
  const demoActive =
    discovery.acceptedCoords !== null &&
    discovery.policy !== null &&
    discovery.acceptedCoords.latitude === discovery.policy.demoLatitude &&
    discovery.acceptedCoords.longitude === discovery.policy.demoLongitude;
  const categories = useMemo(() => flattenCategories(discovery.categories), [discovery.categories]);
  const suggestions = useMemo(
    () =>
      buildSearchSuggestions({
        query: discovery.query,
        items: discovery.suggestionQuery === discovery.query.trim() ? discovery.suggestions : [],
        categories,
        prefiltered: true,
      }),
    [categories, discovery.query, discovery.suggestionQuery, discovery.suggestions],
  );

  useEffect(() => {
    if (!isDiscoveryAlert(discovery.load, discovery.message)) {
      return;
    }
    const id = discovery.statusTick;
    const text = discovery.message;
    setToasts((current) => nextToasts(current, text, id));
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4600);
    toastTimers.current.push(timer);
  }, [discovery.load, discovery.message, discovery.statusTick]);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  function pickSuggestion(suggestion: SearchSuggestion): void {
    if (suggestion.group === "Service") {
      discovery.setCategoryId(suggestion.categoryId);
      discovery.setQuery(suggestion.label);
      return;
    }
    discovery.setQuery(suggestion.label);
    discovery.setSelectedId(suggestion.itemId);
  }

  return (
    <div className="discovery-shell">
      <AppNav />
      <ToastStack toasts={toasts} />
      <div className="discovery-stage" data-map-stage>
        <DiscoveryMap
          tileUrl={discovery.policy?.mapTileUrl ?? ""}
          fallbackTileUrls={discovery.policy?.mapFallbackTileUrls ?? []}
          attribution={discovery.policy?.mapAttribution}
          center={discovery.acceptedCoords}
          overlay={discovery.overlayCoords}
          panCellId={discovery.panCellId}
          markers={discovery.result?.markers ?? []}
          clusters={discovery.result?.clusters ?? []}
          selectedId={discovery.selectedId}
          onSelect={discovery.setSelectedId}
        />
        <div className="discovery-float">
          <SearchSuggest
            query={discovery.query}
            suggestions={suggestions}
            onQueryChange={discovery.setQuery}
            onPick={pickSuggestion}
          />
          <NativeScroller className="discovery-filters" label="Discovery filters">
            {(discovery.policy?.radiusOptionsMeters ?? []).map((option) => (
              <FilterChip
                key={option}
                active={discovery.radiusMeters === option}
                onClick={() => discovery.setRadiusMeters(option)}
              >
                {option >= 1000 ? `${option / 1000}km` : `${option}m`}
              </FilterChip>
            ))}
            <FilterChip
              active={discovery.kinds.includes("PROFESSIONAL")}
              onClick={() => discovery.toggleKind("PROFESSIONAL")}
            >
              Professionals
            </FilterChip>
            <FilterChip
              active={discovery.kinds.includes("BUSINESS")}
              onClick={() => discovery.toggleKind("BUSINESS")}
            >
              Businesses
            </FilterChip>
            {discovery.policy?.includeMembers === true ? (
              <FilterChip
                active={discovery.kinds.includes("MEMBER")}
                onClick={() => discovery.toggleKind("MEMBER")}
              >
                People
              </FilterChip>
            ) : null}
            <FilterChip
              active={discovery.verified}
              onClick={() => discovery.setVerified((value) => !value)}
            >
              Verified
            </FilterChip>
            <FilterChip
              active={discovery.available}
              onClick={() => discovery.setAvailable((value) => !value)}
            >
              Available
            </FilterChip>
            <FilterChip active={demoActive} onClick={() => discovery.useDemoArea()}>
              Seeded area
            </FilterChip>
            {categories.map((category) => (
              <FilterChip
                key={category.id}
                active={discovery.categoryId === category.id}
                onClick={() =>
                  discovery.setCategoryId((current) =>
                    current === category.id ? undefined : category.id,
                  )
                }
              >
                {category.name}
              </FilterChip>
            ))}
          </NativeScroller>
        </div>
      </div>
      <section className="discovery-results" aria-label="Nearby results">
        <BottomSheet>
          {discovery.gps === "denied" || discovery.gps === "unavailable" ? (
            <p>
              <button type="button" onClick={discovery.locate}>
                Retry location
              </button>
            </p>
          ) : null}
          {discovery.load === "error" ? (
            <p>
              <button type="button" onClick={discovery.searchNearby}>
                Retry search
              </button>
            </p>
          ) : null}
          {selected !== null ? <PreviewCard item={selected} preview={discovery.preview} /> : null}
          <NativeScroller className="discovery-row" label="Nearby places">
            {cards.map((item) => (
              <NearbyCard
                key={`${item.kind}-${item.id}`}
                active={item.id === discovery.selectedId}
                title={item.title}
                rating={item.rating}
                distance={item.distanceBucket}
                onClick={() => discovery.setSelectedId(item.id)}
              />
            ))}
          </NativeScroller>
          <NativeScroller className="discovery-row" label="Services">
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
          </NativeScroller>
        </BottomSheet>
      </section>
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
        {item.kind === "MEMBER" ? (
          <>
            {" · "}
            <a href={`/stories/${item.id}`}>Watch presence</a>
          </>
        ) : null}
      </p>
    </div>
  );
}
