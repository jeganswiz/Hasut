import type { ThemeTokens } from "./theme";

export interface PublicThemeConfig {
  version: number;
  tokens: ThemeTokens;
  logoUrl: string | null;
}

export interface PublicFlagsConfig {
  flags: Record<string, boolean>;
}
