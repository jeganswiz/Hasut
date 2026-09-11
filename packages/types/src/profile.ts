export const LOCATION_PERMISSIONS = ["PROMPT", "GRANTED", "DENIED"] as const;
export type LocationPermission = (typeof LOCATION_PERMISSIONS)[number];

export const MEDIA_PURPOSES = [
  "AVATAR",
  "PORTFOLIO",
  "CHAT",
  "BUSINESS",
  "VERIFICATION",
  "THEME_LOGO",
] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const MEDIA_STATUSES = ["PENDING_UPLOAD", "READY", "REJECTED"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const GEOCODER_PROVIDERS = ["console", "nominatim"] as const;
export type GeocoderProviderName = (typeof GEOCODER_PROVIDERS)[number];

export const MEDIA_STORAGE_PROVIDERS = ["memory", "s3"] as const;
export type MediaStorageProviderName = (typeof MEDIA_STORAGE_PROVIDERS)[number];

export interface CurrentModeView {
  code: string;
  label: string;
}

export interface ApproximateLocation {
  label: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
}

export interface ExactLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  updatedAt: string;
}

export interface ProfileCompletion {
  percentage: number;
  fields: {
    displayName: boolean;
    bio: boolean;
    photo: boolean;
    currentMode: boolean;
    statusText: boolean;
    location: boolean;
  };
}

export interface PublicMemberProfile {
  id: string;
  displayName: string;
  bio: string;
  photoUrl: string | null;
  currentMode: CurrentModeView | null;
  statusText: string;
  approximateLocation: ApproximateLocation | null;
}

export interface OwnerMemberProfile extends PublicMemberProfile {
  photoMediaId: string | null;
  isDiscoverable: boolean;
  completion: ProfileCompletion;
}

export interface OwnerLocation {
  permission: LocationPermission;
  exact: ExactLocation | null;
  approximate: ApproximateLocation | null;
}

export interface MediaPresignResult {
  mediaId: string;
  uploadUrl: string;
  objectKey: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface MediaAssetView {
  id: string;
  purpose: MediaPurpose;
  status: MediaStatus;
  mimeType: string;
  byteSize: number;
  url: string | null;
}
