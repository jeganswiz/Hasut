export interface AuthSessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenStorage {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setSession(tokens: AuthSessionTokens): Promise<void>;
  clear(): Promise<void>;
}

export function createMemoryTokenStorage(): TokenStorage {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  return {
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
}
