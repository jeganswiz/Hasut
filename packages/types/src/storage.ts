export const STORAGE_BACKENDS = ["local", "s3", "b2", "wasabi", "r2", "spaces", "minio"] as const;
export type StorageBackendName = (typeof STORAGE_BACKENDS)[number];

export const STORAGE_MIGRATION_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type StorageMigrationStatus = (typeof STORAGE_MIGRATION_STATUSES)[number];

export const STORAGE_MIGRATION_ITEM_STATUSES = ["PENDING", "COPIED", "SKIPPED", "FAILED"] as const;
export type StorageMigrationItemStatus = (typeof STORAGE_MIGRATION_ITEM_STATUSES)[number];

export interface StorageProviderOption {
  id: StorageBackendName;
  label: string;
  summary: string;
  needsCredentials: boolean;
  defaultRegion: string;
  defaultForcePathStyle: boolean;
  endpointHint: string;
}

export const STORAGE_PROVIDER_CATALOG: readonly StorageProviderOption[] = [
  {
    id: "local",
    label: "Server storage",
    summary: "Files stay on this API server. This is the default.",
    needsCredentials: false,
    defaultRegion: "",
    defaultForcePathStyle: false,
    endpointHint: "",
  },
  {
    id: "s3",
    label: "Amazon S3",
    summary: "AWS S3. Leave the endpoint empty unless you use a compatible gateway.",
    needsCredentials: true,
    defaultRegion: "us-east-1",
    defaultForcePathStyle: false,
    endpointHint: "",
  },
  {
    id: "b2",
    label: "Backblaze B2",
    summary: "S3-compatible B2 endpoint. Region looks like us-west-004.",
    needsCredentials: true,
    defaultRegion: "us-west-004",
    defaultForcePathStyle: true,
    endpointHint: "https://s3.us-west-004.backblazeb2.com",
  },
  {
    id: "wasabi",
    label: "Wasabi",
    summary: "S3-compatible Wasabi endpoint for the bucket region.",
    needsCredentials: true,
    defaultRegion: "us-east-1",
    defaultForcePathStyle: true,
    endpointHint: "https://s3.us-east-1.wasabisys.com",
  },
  {
    id: "r2",
    label: "Cloudflare R2",
    summary: "Account endpoint https://<accountid>.r2.cloudflarestorage.com. Region is auto.",
    needsCredentials: true,
    defaultRegion: "auto",
    defaultForcePathStyle: true,
    endpointHint: "https://<accountid>.r2.cloudflarestorage.com",
  },
  {
    id: "spaces",
    label: "DigitalOcean Spaces",
    summary: "Region endpoint such as https://nyc3.digitaloceanspaces.com.",
    needsCredentials: true,
    defaultRegion: "nyc3",
    defaultForcePathStyle: false,
    endpointHint: "https://nyc3.digitaloceanspaces.com",
  },
  {
    id: "minio",
    label: "MinIO",
    summary: "Self-hosted S3-compatible server. Path-style URLs are on by default.",
    needsCredentials: true,
    defaultRegion: "us-east-1",
    defaultForcePathStyle: true,
    endpointHint: "http://127.0.0.1:9000",
  },
];

export interface StorageProfileView {
  id: string;
  provider: StorageBackendName;
  label: string;
  endpoint: string;
  region: string;
  bucket: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
  localRoot: string;
  accessKeyHint: string | null;
  secretConfigured: boolean;
  isActive: boolean;
  readyAssetCount: number;
  createdAt: string;
}

export interface StorageMigrationItemView {
  id: string;
  objectKey: string;
  status: StorageMigrationItemStatus;
  byteSize: number;
  errorMessage: string;
  updatedAt: string;
}

export interface StorageMigrationView {
  id: string;
  status: StorageMigrationStatus;
  fromLabel: string;
  toLabel: string;
  fromProvider: StorageBackendName;
  toProvider: StorageBackendName;
  totalCount: number;
  copiedCount: number;
  failedCount: number;
  skippedCount: number;
  errorMessage: string;
  startedAt: string | null;
  finishedAt: string | null;
  items: StorageMigrationItemView[];
}

export interface StorageOverview {
  active: StorageProfileView;
  profiles: StorageProfileView[];
  providers: StorageProviderOption[];
  migration: StorageMigrationView | null;
}

export interface StorageSwitchResult {
  outcome: "switched" | "confirmation_required" | "migration_started";
  overview: StorageOverview;
  pendingAssetCount: number;
  pendingBytes: number;
}
