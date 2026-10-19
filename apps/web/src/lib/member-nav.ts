import { hasutErrorCode } from "@hasut/api-client";

export type NavSession = "unknown" | "guest" | "member";

/** Routes that belong to the signed-in member. `/stories` stays public so a map pin can be watched. */
const MEMBER_PREFIXES = [
  "/connections",
  "/inbox",
  "/notifications",
  "/me",
  "/story",
  "/live",
  "/conversations",
] as const;

export function showWhenSignedIn(requiresAuth: boolean, session: NavSession): boolean {
  return !requiresAuth || session === "member";
}

export type TabSlot = "shown" | "reserved" | "hidden";

/** Auth tabs stay reserved while the session is unknown so the bar does not jump from 1 to 6 icons. */
export function tabSlot(requiresAuth: boolean, session: NavSession): TabSlot {
  if (!requiresAuth) {
    return "shown";
  }
  if (session === "member") {
    return "shown";
  }
  if (session === "unknown") {
    return "reserved";
  }
  return "hidden";
}

const AUTH_PATHS = ["/login", "/register", "/forgot-password"] as const;

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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
