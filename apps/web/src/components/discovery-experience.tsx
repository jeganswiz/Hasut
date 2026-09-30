"use client";

import type { DiscoveryCard, DiscoveryMarker, DiscoveryPreview } from "@hasut/types";
import { BottomSheet, FilterChip, NearbyCard, ServiceCard } from "@hasut/ui";
import { ownerPresenceCopy, showPinPreviewControl } from "@hasut/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { createWebApiClient } from "../lib/api";
import { flattenCategories } from "../lib/categories";
import {
  browserPinSignals,
  readPinPreviewOverride,
  writePinPreviewOverride,
} from "../lib/pin-playback";
import {
  buildSearchSuggestions,
  isDiscoveryAlert,
  nextToasts,
  type SearchSuggestion,
  type ToastNote,
} from "../lib/discovery-chrome";
import { hasStoryRing } from "../lib/story-ring";
import { useDiscoveryMapController } from "../lib/use-discovery-map";
import { AppNav } from "./app-nav";
import { DiscoveryMap } from "./discovery-map";
import { NativeScroller } from "./native-scroller";
import { SearchSuggest } from "./search-suggest";
import { ToastStack } from "./toast-stack";

export function DiscoveryExperience() {
  const discovery = useDiscoveryMapController();
  const [toasts, setToasts] = useState<ToastNote[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [selfPhotoUrl, setSelfPhotoUrl] = useState<string | null>(null);
  const [playPreviews, setPlayPreviews] = useState(false);
  const [pinSignals, setPinSignals] = useState(() => browserPinSignals(false));
  const toastTimers = useRef<number[]>([]);
  const selected = discovery.result?.items.find((item) => item.id === discovery.selectedId) ?? null;
  const selfMarker =
    selfId === null
      ? null
      : (discovery.result?.markers.find((marker) => marker.id === selfId) ?? null);
  const selfPresence = discovery.result?.selfPresence ?? null;
  const presenceHint = ownerPresenceCopy(
    selfId !== null,
    selfPresence?.kind ?? selfMarker?.pinMediaKind ?? null,
  );
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
    const allowed = readPinPreviewOverride(window.sessionStorage);
    setPlayPreviews(allowed);
    setPinSignals(browserPinSignals(allowed));
  }, []);

  useEffect(() => {
    setPinSignals(browserPinSignals(playPreviews));
  }, [playPreviews]);

  useEffect(() => {
    let cancelled = false;
    void createWebApiClient()
      .getMyProfile()
      .then((mine) => {
        if (!cancelled) {
          setSelfId(mine.id);
          setSelfPhotoUrl(mine.photoUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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
          selfId={selfId}
          selfPhotoUrl={selfPhotoUrl}
          selfHasStory={hasStoryRing(selfPresence?.kind)}
          playPreviews={playPreviews}
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
            {showPinPreviewControl(pinSignals) ? (
              <FilterChip
                active={playPreviews}
                aria-pressed={playPreviews}
                onClick={() => {
                  const next = !playPreviews;
                  writePinPreviewOverride(window.sessionStorage, next);
                  setPlayPreviews(next);
                }}
              >
                Play previews
              </FilterChip>
            ) : null}
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
          {selfId !== null ? (
            <p>
              <a href="/story">Add presence</a>
              {" · "}
              <a href={`/stories/${selfId}`}>Watch presence</a>
            </p>
          ) : null}
          {hasStoryRing(selfPresence?.kind) && selfPresence !== null ? (
            <a
              className="story-ring"
              href={`/stories/${selfPresence.memberId}`}
              aria-label="Your story"
            >
              {selfPresence.imageUrl !== null ? (
                <img src={selfPresence.imageUrl} alt="" />
              ) : (
                <span>Story</span>
              )}
            </a>
          ) : null}
          {presenceHint.length > 0 ? <p>{presenceHint}</p> : null}
          {selected !== null ? (
            <PreviewCard
              item={selected}
              preview={discovery.preview}
              marker={
                discovery.result?.markers.find(
                  (marker) => marker.id === selected.id && marker.kind === selected.kind,
                ) ?? null
              }
              ownerId={selfId}
            />
          ) : null}
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

function PreviewCard({
  item,
  preview,
  marker,
  ownerId,
}: {
  item: DiscoveryCard;
  preview: DiscoveryPreview | null;
  marker: DiscoveryMarker | null;
  ownerId: string | null;
}) {
  const title = preview?.title ?? item.title;
  const subtitle = preview?.subtitle ?? item.subtitle;
  const location = preview?.approximateLocation?.label;
  const watchMemberId = preview?.presence?.memberId ?? (item.kind === "MEMBER" ? item.id : null);
  const storyImage =
    preview?.presence?.imageUrl ??
    (marker !== null && marker.pinMediaKind !== "PROFILE" ? marker.photoUrl : null);
  return (
    <div className="discovery-preview">
      <h2 style={{ margin: "0 0 8px" }}>{title}</h2>
      <p style={{ margin: "0 0 8px" }}>{subtitle}</p>
      {location !== undefined ? <p>{location}</p> : null}
      {watchMemberId !== null && (storyImage !== null || hasStoryRing(preview?.presence?.kind)) ? (
        <a className="story-ring" href={`/stories/${watchMemberId}`} aria-label="Watch presence">
          {storyImage !== null ? <img src={storyImage} alt="" /> : <span>Story</span>}
        </a>
      ) : null}
      <p>
        {preview?.distanceBucket ?? item.distanceBucket}
        {(preview?.verified ?? item.verified) ? " · Verified" : ""}
        {(preview?.available ?? item.available) ? " · Available" : ""}
      </p>
      <p>
        <a href={preview?.href ?? item.href}>Open full profile</a>
        {watchMemberId !== null ? (
          <>
            {" · "}
            <a href={`/stories/${watchMemberId}`}>Watch presence</a>
          </>
        ) : null}
        {ownerId !== null && item.id === ownerId ? (
          <>
            {" · "}
            <a href="/story">Add presence</a>
          </>
        ) : null}
      </p>
    </div>
  );
}
