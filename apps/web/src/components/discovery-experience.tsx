"use client";

import type { DiscoveryCard, DiscoveryKind, DiscoveryPreview, DiscoveryRoute } from "@hasut/types";
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
import { profileRingClass, profileRingState } from "../lib/story-ring";
import { useWatchedStoryIds } from "../lib/use-watched-stories";
import { useDiscoveryMapController } from "../lib/use-discovery-map";
import { AppNav } from "./app-nav";
import { DiscoveryMap } from "./discovery-map";
import { NativeScroller } from "./native-scroller";
import { SearchSuggest } from "./search-suggest";
import { StoryTray } from "./story-tray";
import { ToastStack } from "./toast-stack";

export function DiscoveryExperience() {
  const discovery = useDiscoveryMapController();
  const [toasts, setToasts] = useState<ToastNote[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [selfPhotoUrl, setSelfPhotoUrl] = useState<string | null>(null);
  const [selfName, setSelfName] = useState("You");
  const [routeTarget, setRouteTarget] = useState<{ id: string; kind: DiscoveryKind } | null>(null);
  const [route, setRoute] = useState<DiscoveryRoute | null>(null);
  const [routeLoad, setRouteLoad] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [routeMessage, setRouteMessage] = useState("");
  const [playPreviews, setPlayPreviews] = useState(false);
  const [pinSignals, setPinSignals] = useState(() => browserPinSignals(false));
  const toastTimers = useRef<number[]>([]);
  const selected = discovery.result?.items.find((item) => item.id === discovery.selectedId) ?? null;
  const selfMarker =
    selfId === null
      ? null
      : (discovery.result?.markers.find((marker) => marker.id === selfId) ?? null);
  const selfPresence = discovery.result?.selfPresence ?? null;
  const watchedStoryIds = useWatchedStoryIds();
  const selfRingClass = profileRingClass(
    profileRingState({
      live: (selfPresence?.kind ?? selfMarker?.pinMediaKind) === "LIVE",
      storyIds: selfPresence?.storyIds ?? selfMarker?.storyIds ?? [],
      watchedStoryIds,
    }),
  );
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
          setSelfName(mine.displayName);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function clearRoute(): void {
    setRouteTarget(null);
    setRoute(null);
    setRouteLoad("idle");
    setRouteMessage("");
  }

  useEffect(() => {
    if (routeTarget === null) {
      return;
    }
    if (discovery.acceptedCoords === null) {
      setRouteLoad("error");
      setRouteMessage("Your location is not available yet.");
      return;
    }
    let cancelled = false;
    setRouteLoad("loading");
    setRouteMessage("Finding a route…");
    void createWebApiClient()
      .routeTo({
        latitude: discovery.acceptedCoords.latitude,
        longitude: discovery.acceptedCoords.longitude,
        radiusMeters: discovery.radiusMeters,
        targetKind: routeTarget.kind,
        targetId: routeTarget.id,
      })
      .then((next) => {
        if (cancelled) {
          return;
        }
        setRoute(next);
        setRouteLoad("success");
        setRouteMessage(routeSummary(next));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setRoute(null);
        setRouteLoad("error");
        setRouteMessage("No route is available between these places.");
      });
    return () => {
      cancelled = true;
    };
  }, [discovery.acceptedCoords, discovery.radiusMeters, routeTarget]);

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
      <AppNav
        search={
          <SearchSuggest
            query={discovery.query}
            suggestions={suggestions}
            onQueryChange={discovery.setQuery}
            onPick={pickSuggestion}
          />
        }
      />
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
          selectedId={discovery.selectedId}
          selfId={selfId}
          selfPhotoUrl={selfPhotoUrl}
          selfRingClass={selfRingClass}
          watchedStoryIds={watchedStoryIds}
          playPreviews={playPreviews}
          route={route?.coordinates ?? null}
          onClearRoute={clearRoute}
          onLocate={discovery.locate}
          callout={
            selected === null ? null : (
              <PreviewCard
                item={selected}
                preview={discovery.preview}
                routeLoad={routeTarget?.id === selected.id ? routeLoad : "idle"}
                routeMessage={routeTarget?.id === selected.id ? routeMessage : ""}
                onRoute={() => setRouteTarget({ id: selected.id, kind: selected.kind })}
                onClose={() => discovery.setSelectedId(null)}
              />
            )
          }
          onSelect={discovery.setSelectedId}
        />
        <div className="discovery-float">
          <NativeScroller className="discovery-filters" label="Discovery filters" wheel>
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
          <StoryTray
            selfId={selfId}
            selfLabel={selfName}
            selfImageUrl={selfPresence?.imageUrl ?? selfPhotoUrl}
            selfKind={selfPresence?.kind ?? null}
            selfStoryIds={selfPresence?.storyIds ?? []}
            faces={discovery.result?.storyFaces ?? []}
            watchedStoryIds={watchedStoryIds}
            hint={presenceHint}
          />
          <NativeScroller className="discovery-row" label="Nearby places">
            {discovery.load === "loading" && cards.length === 0
              ? [0, 1, 2, 3].map((item) => (
                  <span key={item} className="hasut-skeleton card-skeleton" aria-hidden="true" />
                ))
              : cards.map((item) => (
                  <NearbyCard
                    key={`${item.kind}-${item.id}`}
                    active={item.id === discovery.selectedId}
                    title={item.title}
                    rating={item.rating}
                    distance={item.distanceBucket}
                    photoUrl={item.photoUrl}
                    onClick={() => discovery.setSelectedId(item.id)}
                  />
                ))}
          </NativeScroller>
          <NativeScroller className="discovery-row" label="Services">
            {discovery.load === "loading" && services.length === 0
              ? [0, 1, 2].map((item) => (
                  <span
                    key={item}
                    className="hasut-skeleton card-skeleton card-skeleton-wide"
                    aria-hidden="true"
                  />
                ))
              : services.map((item) => (
                  <ServiceCard
                    key={`service-${item.id}`}
                    title={item.title}
                    categoryLabel={item.categoryLabel}
                    rating={item.rating}
                    photoUrl={item.photoUrl}
                    coverUrl={categoryCover(item.categoryLabel, categories)}
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

function categoryCover(
  label: string | null,
  categories: Array<{ name: string; iconUrl?: string | null }>,
): string | null {
  if (label === null) {
    return null;
  }
  const icon = categories.find(
    (category) => category.name.toLowerCase() === label.toLowerCase(),
  )?.iconUrl;
  return icon !== undefined && icon !== null && icon.length > 0 ? icon : null;
}

function routeSummary(next: DiscoveryRoute): string {
  const minutes = Math.max(1, Math.round(next.durationSeconds / 60));
  const distance =
    next.distanceMeters >= 1000
      ? `${(next.distanceMeters / 1000).toFixed(1)} km`
      : `${Math.round(next.distanceMeters)} m`;
  return `${minutes} min · ${distance}`;
}

function PreviewCard({
  item,
  preview,
  routeLoad,
  routeMessage,
  onRoute,
  onClose,
}: {
  item: DiscoveryCard;
  preview: DiscoveryPreview | null;
  routeLoad: "idle" | "loading" | "error" | "success";
  routeMessage: string;
  onRoute: () => void;
  onClose: () => void;
}) {
  const title = preview?.title ?? item.title;
  const subtitle = preview?.subtitle ?? item.subtitle;
  const location = preview?.approximateLocation?.label;
  const photoUrl = preview?.photoUrl ?? item.photoUrl;
  const available = preview?.available ?? item.available;
  const verified = preview?.verified ?? item.verified;
  const distance = preview?.distanceBucket ?? item.distanceBucket;
  const routeLabel =
    routeLoad === "loading"
      ? "Finding a route…"
      : routeLoad === "success" && routeMessage.length > 0
        ? `View route · ${routeMessage}`
        : "View route";
  return (
    <article className="map-place-card">
      <header className="map-place-head">
        {photoUrl !== null && photoUrl.length > 0 ? (
          <img className="map-place-photo" src={photoUrl} alt="" />
        ) : (
          <span className="map-place-photo" aria-hidden="true">
            {placeInitials(title)}
          </span>
        )}
        <div className="map-place-title">
          <strong>{title}</strong>
          <p>{subtitle}</p>
        </div>
        <button type="button" className="map-place-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      {location !== undefined ? (
        <p className="map-place-meta">
          <PinIcon />
          <span>{location}</span>
        </p>
      ) : null}
      <p className="map-place-meta">
        <RangeIcon />
        <span>
          {distance}
          {verified ? " · Verified" : ""}
          {available ? " · Available" : ""}
        </span>
      </p>
      <a className="map-place-link" href={preview?.href ?? item.href}>
        Open full profile
        <span aria-hidden="true"> →</span>
      </a>
      <button
        type="button"
        className="map-place-route"
        onClick={() => {
          if (routeLoad !== "success") {
            onRoute();
          }
        }}
        disabled={routeLoad === "loading"}
        aria-label="View route"
      >
        <CarIcon />
        <span>{routeLabel}</span>
        <ChevronIcon />
      </button>
      {routeLoad === "error" ? <p className="map-place-error">{routeMessage}</p> : null}
    </article>
  );
}

function placeInitials(title: string): string {
  const letters = title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
  return letters.length > 0 ? letters : "?";
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

function RangeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h4l2-5 4 10 2-5h4" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 15v2h2a2 2 0 0 0 4 0h4a2 2 0 0 0 4 0h2v-3l-2-5H7L4 15z" />
      <path d="M7 10l1.2-3h7.6L17 10" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
