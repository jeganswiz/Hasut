import { createHasutApiClient } from "@hasut/api-client";
import { parsePublicClientEnv } from "@hasut/config";
import { mobileTokenStorage } from "./token-storage";

export const MOBILE_SURFACE = "member-mobile" as const;

export function mobileApiBaseUrl(): string {
  return parsePublicClientEnv(process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001")
    .apiBaseUrl;
}

export function createMobileApiClient() {
  return createHasutApiClient({
    baseUrl: mobileApiBaseUrl(),
    tokenStorage: mobileTokenStorage,
  });
}
