import { THEME_CSS_VARIABLES } from "@hasut/config";
import type { ThemeTokens } from "@hasut/types";

export function cssVar(token: keyof ThemeTokens): string {
  return `var(${THEME_CSS_VARIABLES[token]})`;
}
