export const DISCOVERY_KINDS = ["MEMBER", "PROFESSIONAL", "BUSINESS"] as const;
export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number];

export const MAP_BASEMAP_PROVIDERS = ["maptiler", "stadia", "carto"] as const;
export type MapBasemapProvider = (typeof MAP_BASEMAP_PROVIDERS)[number];

export const DISCOVERY_PRESENCE_EVENT = "presence.updated" as const;
export const DISCOVERY_REALTIME_NAMESPACE = "/ws/v1/discovery";

export interface DiscoveryPin {
  pinLat: number;
  pinLng: number;
}

export interface DiscoveryCard {
  id: string;
  kind: DiscoveryKind;
  title: string;
  subtitle: string;
  photoUrl: string | null;
  categoryLabel: string | null;
  rating: number | null;
  reviewCount: number;
  distanceBucket: string;
  verified: boolean;
  available: boolean;
  href: string;
}

export interface DiscoveryMarker extends DiscoveryPin {
  id: string;
  kind: DiscoveryKind;
  label: string;
  rating: number | null;
  selected: boolean;
}

export interface DiscoveryCluster extends DiscoveryPin {
  id: string;
  count: number;
  kinds: DiscoveryKind[];
}

export interface DiscoveryPreview {
  id: string;
  kind: DiscoveryKind;
  title: string;
  subtitle: string;
  bio: string;
  photoUrl: string | null;
  categoryLabels: string[];
  rating: number | null;
  reviewCount: number;
  distanceBucket: string;
  verified: boolean;
  available: boolean;
  approximateLocation: {
    label: string;
    city: string | null;
    region: string | null;
    country: string | null;
    countryCode: string | null;
  } | null;
  href: string;
}

export interface DiscoveryResult {
  originLabel: string | null;
  radiusMeters: number;
  items: DiscoveryCard[];
  markers: DiscoveryMarker[];
  clusters: DiscoveryCluster[];
}

export interface DiscoveryPolicyView {
  defaultRadiusMeters: number;
  minRadiusMeters: number;
  maxRadiusMeters: number;
  radiusOptionsMeters: number[];
  clusterCellMeters: number;
  includeMembers: boolean;
  availableCodes: string[];
  availableModeCodes: string[];
  mapProvider: MapBasemapProvider;
  mapCustomTileUrl: string;
  mapTileUrl: string;
  mapFallbackTileUrls: string[];
  mapAttribution: string;
  demoLatitude: number;
  demoLongitude: number;
  minUpdateIntervalSeconds: number;
  significantMoveMeters: number;
  geolocationTimeoutMs: number;
  searchDebounceMs: number;
}

export interface DiscoveryPresenceUpdated {
  marker: DiscoveryMarker;
}

export interface DiscoveryRankingWeightsView {
  distance: number;
  categoryRelevance: number;
  availability: number;
  verification: number;
  rating: number;
  activity: number;
}

export interface PublicBusiness {
  id: string;
  name: string;
  description: string;
  verificationStatus: string;
  categories: Array<{ id: string; name: string; slug: string }>;
  approximateLocation: {
    label: string;
    city: string | null;
    region: string | null;
    country: string | null;
    countryCode: string | null;
  } | null;
}
