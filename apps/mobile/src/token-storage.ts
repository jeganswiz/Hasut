import type { AuthSessionTokens, TokenStorage } from "@hasut/auth";

let accessToken: string | null = null;
let refreshToken: string | null = null;

export const mobileTokenStorage: TokenStorage = {
  async getAccessToken() {
    return accessToken;
  },
  async getRefreshToken() {
    return refreshToken;
  },
  async setSession(tokens: AuthSessionTokens) {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
  },
  async clear() {
    accessToken = null;
    refreshToken = null;
  },
};
