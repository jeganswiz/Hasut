export const THEME_TOKEN_KEYS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "mutedText",
  "textOnPrimary",
  "success",
  "warning",
  "danger",
  "border",
  "radius",
  "buttonRadius",
  "cardRadius",
] as const;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];

export type ThemeTokens = Record<ThemeTokenKey, string>;
