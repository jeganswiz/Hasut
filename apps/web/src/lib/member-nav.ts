import { hasutErrorCode } from "@hasut/api-client";

export type NavSession = "unknown" | "guest" | "member";

/** Routes that belong to the signed-in member. `/stories` stays public so a map pin can be watched. */
const MEMBER_PREFIXES = [
  "/connections",
  "/inbox",
  "/notifications",
  "/me",
  "/story",
  "/conversations",
] as const;

export function showWhenSignedIn(requiresAuth: boolean, session: NavSession): boolean {
  return !requiresAuth || session === "member";
}

export function isMemberPath(pathname: string): boolean {
  return MEMBER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isUnauthenticated(error: unknown): boolean {
  return hasutErrorCode(error) === "UNAUTHENTICATED";
}

export function loginHref(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function redirectToLogin(nextPath: string): void {
  window.location.assign(loginHref(nextPath));
}
