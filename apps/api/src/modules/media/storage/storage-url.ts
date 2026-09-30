import { resolve } from "node:path";
import type { StorageBackendName } from "@hasut/types";
import { STORAGE_PROVIDER_CATALOG } from "@hasut/types";

export interface StorageConnection {
  id: string;
  provider: StorageBackendName;
  label: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
  localRoot: string;
  updatedAt: string;
}

const PRISMA_PROVIDER = {
  local: "LOCAL",
  s3: "S3",
  b2: "B2",
  wasabi: "WASABI",
  r2: "R2",
  spaces: "SPACES",
  minio: "MINIO",
} as const;

export function toPrismaProvider(
  provider: StorageBackendName,
): (typeof PRISMA_PROVIDER)[StorageBackendName] {
  return PRISMA_PROVIDER[provider];
}

export function fromPrismaProvider(provider: string): StorageBackendName {
  const match = (Object.keys(PRISMA_PROVIDER) as StorageBackendName[]).find(
    (name) => PRISMA_PROVIDER[name] === provider,
  );
  if (match === undefined) {
    throw new Error("Unknown storage provider");
  }
  return match;
}

export function providerOption(provider: StorageBackendName) {
  const option = STORAGE_PROVIDER_CATALOG.find((item) => item.id === provider);
  if (option === undefined) {
    throw new Error("Unknown storage provider");
  }
  return option;
}

/** Fills a blank endpoint for providers whose host is determined by region. */
export function resolveStorageEndpoint(
  provider: StorageBackendName,
  region: string,
  endpoint: string,
): string {
  const trimmed = endpoint.trim().replace(/\/$/, "");
  if (trimmed.length > 0) {
    return trimmed;
  }
  if (provider === "b2" && region.length > 0) {
    return `https://s3.${region}.backblazeb2.com`;
  }
  if (provider === "wasabi" && region.length > 0) {
    return `https://s3.${region}.wasabisys.com`;
  }
  if (provider === "spaces" && region.length > 0) {
    return `https://${region}.digitaloceanspaces.com`;
  }
  return "";
}

export function encodeObjectKey(objectKey: string): string {
  return objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Browser URL for an object. Remote buckets are served by the API unless the
 * admin set a public CDN or bucket URL.
 */
export function publicObjectUrl(
  connection: StorageConnection,
  objectKey: string,
  apiOrigin: string,
  apiPrefix: string,
): string {
  const encoded = encodeObjectKey(objectKey);
  if (connection.provider !== "local" && connection.publicBaseUrl.length > 0) {
    return `${connection.publicBaseUrl.replace(/\/$/, "")}/${encoded}`;
  }
  const base = (
    connection.provider === "local" && connection.publicBaseUrl.length > 0
      ? connection.publicBaseUrl
      : apiOrigin
  ).replace(/\/$/, "");
  return `${base}/${apiPrefix}/media/files/${encoded}`;
}

export function samePhysicalStore(left: StorageConnection, right: StorageConnection): boolean {
  if (left.provider === "local" && right.provider === "local") {
    return resolve(left.localRoot) === resolve(right.localRoot);
  }
  if (left.provider === "local" || right.provider === "local") {
    return false;
  }
  return (
    left.endpoint === right.endpoint && left.bucket === right.bucket && left.region === right.region
  );
}

export function accessKeyHint(accessKey: string): string | null {
  if (accessKey.length === 0) {
    return null;
  }
  if (accessKey.length <= 4) {
    return "••••";
  }
  return `••••${accessKey.slice(-4)}`;
}
