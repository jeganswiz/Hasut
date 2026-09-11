import type { AuthSessionTokens, TokenStorage } from "@hasut/auth";

const ACCESS_KEY = "hasut.admin.accessToken";
const REFRESH_KEY = "hasut.admin.refreshToken";

export function createBrowserTokenStorage(): TokenStorage {
  return {
    async getAccessToken() {
      if (typeof window === "undefined") {
        return null;
      }
      return window.localStorage.getItem(ACCESS_KEY);
    },
    async getRefreshToken() {
      if (typeof window === "undefined") {
        return null;
      }
      return window.localStorage.getItem(REFRESH_KEY);
    },
    async setSession(tokens: AuthSessionTokens) {
      window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
      window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    },
    async clear() {
      window.localStorage.removeItem(ACCESS_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
    },
  };
}

export const adminTokenStorage = createBrowserTokenStorage();
