import { createHasutApiClient } from "@hasut/api-client";
import { resolveBrowserApiBaseUrl } from "@hasut/config";
import { webTokenStorage } from "./token-storage";

export const WEB_SURFACE = "member-web" as const;

export function webApiBaseUrl(): string {
  return resolveBrowserApiBaseUrl(
    process.env.HASUT_API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL,
    {
      isBrowser: typeof window !== "undefined",
      pageOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  );
}

export function createWebApiClient() {
  return createHasutApiClient({
    baseUrl: webApiBaseUrl(),
    tokenStorage: webTokenStorage,
  });
}
