import { createHasutApiClient } from "@hasut/api-client";
import { resolveBrowserApiBaseUrl } from "@hasut/config";
import { adminTokenStorage } from "./token-storage";

export const ADMIN_SURFACE = "admin-web" as const;

export function adminApiBaseUrl(): string {
  return resolveBrowserApiBaseUrl(
    process.env.HASUT_API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL,
    {
      isBrowser: typeof window !== "undefined",
      pageOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  );
}

export function createAdminApiClient() {
  return createHasutApiClient({
    baseUrl: adminApiBaseUrl(),
    tokenStorage: adminTokenStorage,
  });
}
