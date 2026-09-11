"use client";

import type { DiscoveryCard, DiscoveryPreview } from "@hasut/types";
import { BottomSheet, FilterChip, NearbyCard, SearchBar, ServiceCard } from "@hasut/ui";
import { AppNav } from "./app-nav";
import { DiscoveryMap } from "./discovery-map";
import { flattenCategories } from "../lib/categories";
import { useDiscoveryMapController } from "../lib/use-discovery-map";

export function DiscoveryExperience() {
  const discovery = useDiscoveryMapController();
  const selected = discovery.result?.items.find((item) => item.id === discovery.selectedId) ?? null;
  const cards = discovery.result?.items ?? [];
  const services = discovery.result?.items.filter((item) => item.kind === "PROFESSIONAL") ?? [];
  const demoActive =
    discovery.acceptedCoords !== null &&
    discovery.policy !== null &&
    discovery.acceptedCoords.latitude === discovery.policy.demoLatitude &&
    discovery.acceptedCoords.longitude === discovery.policy.demoLongitude;

  return (
    <div className="discovery-shell">
      <DiscoveryMap
        tileUrl={discovery.policy?.mapTileUrl ?? ""}
        center={discovery.acceptedCoords}
        overlay={discovery.overlayCoords}
        panCellId={discovery.panCellId}
        markers={discovery.result?.markers ?? []}
        clusters={discovery.result?.clusters ?? []}
        selectedId={discovery.selectedId}
        onSelect={discovery.setSelectedId}
      />
      <div className="discovery-overlay">
        <div className="discovery-top">
          <AppNav />
          <SearchBar
            placeholder="Search service"
            value={discovery.query}
            onChange={(event) => discovery.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                discovery.searchNearby();
              }
            }}
          />
          <p className="discovery-status">{discovery.message}</p>
          <div className="discovery-filters">
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
            {flattenCategories(discovery.categories).map((category) => (
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
          </div>
        </div>
        <div className="discovery-sheet">
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
            <div className="discovery-row">
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
