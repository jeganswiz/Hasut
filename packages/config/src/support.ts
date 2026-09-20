export interface SupportCategorySeed {
  slug: string;
  name: string;
  sortOrder: number;
}

/** Seed / fallback catalog — UI lists these from the API, never hardcodes names. */
export const SUPPORT_CATEGORY_SEEDS: SupportCategorySeed[] = [
  { slug: "account", name: "Account and login", sortOrder: 10 },
  { slug: "verification", name: "Identity verification", sortOrder: 20 },
  { slug: "discovery", name: "Discovery and profiles", sortOrder: 30 },
  { slug: "safety", name: "Safety and reports", sortOrder: 40 },
  { slug: "other", name: "Something else", sortOrder: 90 },
];
