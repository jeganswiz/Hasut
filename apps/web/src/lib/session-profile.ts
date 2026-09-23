import { HasutApiError } from "@hasut/api-client";
import type { AuthSessionTokens } from "@hasut/auth";
import type { OwnerMemberProfile } from "@hasut/types";

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED";
}

export async function loadNavProfile(io: {
  getAccessToken: () => Promise<string | null>;
  getRefreshToken: () => Promise<string | null>;
  readProfile: () => Promise<OwnerMemberProfile>;
  refresh: (refreshToken: string) => Promise<AuthSessionTokens>;
  save: (tokens: AuthSessionTokens) => Promise<void>;
}): Promise<OwnerMemberProfile | null> {
  const access = await io.getAccessToken();
  if (access === null || access.length === 0) {
    return null;
  }
  try {
    return await io.readProfile();
  } catch (error) {
    if (!isUnauthenticated(error)) {
      return null;
    }
  }
  const refreshToken = await io.getRefreshToken();
  if (refreshToken === null || refreshToken.length === 0) {
    return null;
  }
  try {
    const next = await io.refresh(refreshToken);
    await io.save({ accessToken: next.accessToken, refreshToken: next.refreshToken });
    return await io.readProfile();
  } catch {
    return null;
  }
}
