import type { ThemeTokens } from "./theme";

export interface PublicThemeConfig {
  version: number;
  tokens: ThemeTokens;
}

export interface PublicFlagsConfig {
  flags: Record<string, boolean>;
}
