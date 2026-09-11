import type { ThemeTokens } from "@hasut/types";

/**
 * Boot-time fallback only. Runtime theme is loaded from remote configuration
 * (Sprint 1+) and cached. Feature UI must consume tokens, not these literals.
 */
export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  primary: "#6D28D9",
  secondary: "#4C1D95",
  accent: "#EAB308",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  mutedText: "#64748B",
  textOnPrimary: "#FFFFFF",
  success: "#15803D",
  warning: "#C2410C",
  danger: "#DC2626",
  border: "#E2E8F0",
  radius: "12px",
  buttonRadius: "14px",
  cardRadius: "16px",
};

export const THEME_CSS_VARIABLES: Record<keyof ThemeTokens, string> = {
  primary: "--hasut-color-primary",
  secondary: "--hasut-color-secondary",
  accent: "--hasut-color-accent",
  background: "--hasut-color-background",
  surface: "--hasut-color-surface",
  text: "--hasut-color-text",
  mutedText: "--hasut-color-muted-text",
  textOnPrimary: "--hasut-color-text-on-primary",
  success: "--hasut-color-success",
  warning: "--hasut-color-warning",
  danger: "--hasut-color-danger",
  border: "--hasut-color-border",
  radius: "--hasut-radius",
  buttonRadius: "--hasut-radius-button",
  cardRadius: "--hasut-radius-card",
};

export function themeToCssText(tokens: ThemeTokens = DEFAULT_THEME_TOKENS): string {
  const lines = Object.entries(THEME_CSS_VARIABLES).map(([key, cssVar]) => {
    const value = tokens[key as keyof ThemeTokens];
    return `  ${cssVar}: ${value};`;
  });
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export interface CachedConfig<T> {
  value: T;
  expiresAt: number;
}

export function isCacheFresh<T>(entry: CachedConfig<T> | undefined, now = Date.now()): boolean {
  return entry !== undefined && entry.expiresAt > now;
}
