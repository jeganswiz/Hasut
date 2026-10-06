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

export const PIN_MEDIA_KINDS = ["LIVE", "VIDEO", "IMAGE", "PROFILE"] as const;
export type PinMediaKind = (typeof PIN_MEDIA_KINDS)[number];

export interface DiscoveryMarker extends DiscoveryPin {
  id: string;
  kind: DiscoveryKind;
  label: string;
  rating: number | null;
  selected: boolean;
  photoUrl: string | null;
  initials: string;
  available: boolean;
  ring: "idle" | "available" | "live";
  pinMediaKind: PinMediaKind;
  previewHlsUrl: string | null;
}

export interface DiscoveryCluster extends DiscoveryPin {
  id: string;
  count: number;
  kinds: DiscoveryKind[];
}

/** A live or posted story that can be opened from a map profile. */
export interface DiscoveryPresence {
  memberId: string;
  kind: "LIVE" | "VIDEO" | "IMAGE" | null;
  imageUrl: string | null;
}

/** One face in the map story row. Only members with an active story are included. */
export interface DiscoveryStoryFace {
  memberId: string;
  label: string;
  imageUrl: string | null;
  kind: "LIVE" | "VIDEO" | "IMAGE";
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
  /** Set for a person who can have a story. Businesses stay null. */
  presence: DiscoveryPresence | null;
}

export interface DiscoveryRoute {
  provider: "maptiler" | "stadia" | "osrm";
  distanceMeters: number;
  durationSeconds: number;
  /** Road line as [longitude, latitude], ending at the public pin. */
  coordinates: Array<[number, number]>;
}

export interface DiscoveryResult {
  originLabel: string | null;
  radiusMeters: number;
  items: DiscoveryCard[];
  markers: DiscoveryMarker[];
  clusters: DiscoveryCluster[];
  /** The signed-in member's own story, even though their pin is not in `markers`. */
  selfPresence?: DiscoveryPresence | null;
  /** Nearby members who have an active story, in map order. The viewer's own face is not included. */
  storyFaces?: DiscoveryStoryFace[];
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
