import { THEME_TOKEN_KEYS } from "@hasut/types";
import { z } from "zod";

export const publicThemeConfigSchema = z.object({
  version: z.number().int().positive(),
  tokens: z.object(
    Object.fromEntries(THEME_TOKEN_KEYS.map((key) => [key, z.string().min(1)])) as Record<
      (typeof THEME_TOKEN_KEYS)[number],
      z.ZodString
    >,
  ),
});

export const publicFlagsConfigSchema = z.object({
  flags: z.record(z.boolean()),
});
