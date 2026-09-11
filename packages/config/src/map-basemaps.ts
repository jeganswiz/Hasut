import { MAP_BASEMAP_PROVIDERS, type MapBasemapProvider } from "@hasut/types";

export const CARTO_POSITRON_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export const OSM_MAP_ATTRIBUTION = "© OpenStreetMap";

export interface MapBasemapCatalogEntry {
  id: MapBasemapProvider;
  label: string;
  description: string;
  attribution: string;
}

export const MAP_BASEMAP_CATALOG: Record<MapBasemapProvider, MapBasemapCatalogEntry> = {
  maptiler: {
    id: "maptiler",
    label: "MapTiler Dataviz",
    description: "Primary raster. Requires MAPTILER_API_KEY on the API.",
    attribution: `${OSM_MAP_ATTRIBUTION} © MapTiler`,
  },
  stadia: {
    id: "stadia",
    label: "Stadia Alidade Smooth",
    description: "First fallback. Optional STADIA_API_KEY on the API.",
    attribution: `${OSM_MAP_ATTRIBUTION} © Stadia Maps`,
  },
  carto: {
    id: "carto",
    label: "CARTO Positron",
    description: "Last-resort public raster when keyed providers are unavailable.",
    attribution: `${OSM_MAP_ATTRIBUTION} © CARTO`,
  },
};

export const MAP_BASEMAP_OPTIONS = MAP_BASEMAP_PROVIDERS.map((id) => MAP_BASEMAP_CATALOG[id]);

export function isMapBasemapProvider(value: unknown): value is MapBasemapProvider {
  return typeof value === "string" && (MAP_BASEMAP_PROVIDERS as readonly string[]).includes(value);
}

export function mapTilerDatavizTileUrl(apiKey: string): string {
  return `https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}`;
}

export function stadiaAlidadeSmoothTileUrl(apiKey: string): string {
  const base = "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png";
  return apiKey.length > 0 ? `${base}?api_key=${encodeURIComponent(apiKey)}` : base;
}

export interface MapTileChainInput {
  primary: MapBasemapProvider;
  customTileUrl?: string;
  maptilerApiKey?: string;
  stadiaApiKey?: string;
}

export interface MapTileChain {
  provider: MapBasemapProvider;
  tileUrl: string;
  fallbackTileUrls: string[];
  attribution: string;
}

function uniqueUrls(urls: Array<string | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (url === null || url.length === 0 || seen.has(url)) {
      continue;
    }
    seen.add(url);
    out.push(url);
  }
  return out;
}

function urlForProvider(
  provider: MapBasemapProvider,
  maptilerApiKey: string,
  stadiaApiKey: string,
): string | null {
  if (provider === "maptiler") {
    return maptilerApiKey.length > 0 ? mapTilerDatavizTileUrl(maptilerApiKey) : null;
  }
  if (provider === "stadia") {
    return stadiaAlidadeSmoothTileUrl(stadiaApiKey);
  }
  return CARTO_POSITRON_TILE_URL;
}

/** Primary plus up to two fallbacks: MapTiler → Stadia → CARTO, skipping unavailable keys. */
export function resolveMapTileChain(input: MapTileChainInput): MapTileChain {
  const maptilerApiKey = input.maptilerApiKey?.trim() ?? "";
  const stadiaApiKey = input.stadiaApiKey?.trim() ?? "";
  const custom = input.customTileUrl?.trim() ?? "";
  const order: MapBasemapProvider[] = [
    input.primary,
    ...MAP_BASEMAP_PROVIDERS.filter((id) => id !== input.primary),
  ];
  const chain = uniqueUrls([
    custom.length > 0 ? custom : null,
    ...order.map((provider) => urlForProvider(provider, maptilerApiKey, stadiaApiKey)),
  ]);
  const tileUrl = chain[0] ?? CARTO_POSITRON_TILE_URL;
  return {
    provider: input.primary,
    tileUrl,
    fallbackTileUrls: chain.slice(1, 3),
    attribution:
      custom.length > 0 && tileUrl === custom
        ? OSM_MAP_ATTRIBUTION
        : MAP_BASEMAP_CATALOG[input.primary].attribution,
  };
}

export function advanceBasemapIndex(index: number, chainLength: number): number | null {
  if (index < 0 || chainLength <= 1) {
    return null;
  }
  const next = index + 1;
  return next < chainLength ? next : null;
}
