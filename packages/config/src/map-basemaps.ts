import { MAP_BASEMAP_PROVIDERS, type MapBasemapProvider } from "@hasut/types";

export const CARTO_POSITRON_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

/** Esri World Imagery. The path order is z/y/x, which Leaflet fills by placeholder name. */
export const ESRI_WORLD_IMAGERY_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const ESRI_WORLD_IMAGERY_ATTRIBUTION =
  "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

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
    label: "MapTiler Satellite",
    description: "Satellite raster. Requires MAPTILER_API_KEY on the API.",
    attribution: `${OSM_MAP_ATTRIBUTION} © MapTiler`,
  },
  stadia: {
    id: "stadia",
    label: "Stadia Satellite",
    description: "Satellite fallback. Requires STADIA_API_KEY on the API.",
    attribution: `${OSM_MAP_ATTRIBUTION} © Stadia Maps © CNES, Distribution Airbus DS, © Airbus DS, © PlanetObserver`,
  },
  carto: {
    id: "carto",
    label: "Esri World Imagery",
    description: "Satellite imagery used when a keyed provider is unavailable.",
    attribution: ESRI_WORLD_IMAGERY_ATTRIBUTION,
  },
};

export const MAP_BASEMAP_OPTIONS = MAP_BASEMAP_PROVIDERS.map((id) => MAP_BASEMAP_CATALOG[id]);

export function isMapBasemapProvider(value: unknown): value is MapBasemapProvider {
  return typeof value === "string" && (MAP_BASEMAP_PROVIDERS as readonly string[]).includes(value);
}

export function mapTilerDatavizTileUrl(apiKey: string): string {
  return `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${encodeURIComponent(apiKey)}`;
}

export function stadiaAlidadeSmoothTileUrl(apiKey: string): string {
  const base = "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg";
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
    return stadiaApiKey.length > 0 ? stadiaAlidadeSmoothTileUrl(stadiaApiKey) : null;
  }
  return ESRI_WORLD_IMAGERY_TILE_URL;
}

/** Primary plus up to two fallbacks. Every layer is satellite imagery. */
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
  const tileUrl = chain[0] ?? ESRI_WORLD_IMAGERY_TILE_URL;
  return {
    provider: input.primary,
    tileUrl,
    fallbackTileUrls: chain.slice(1, 3),
    attribution: attributionForTile(tileUrl, input.primary, custom),
  };
}

function attributionForTile(tileUrl: string, primary: MapBasemapProvider, custom: string): string {
  if (custom.length > 0 && tileUrl === custom) {
    return OSM_MAP_ATTRIBUTION;
  }
  if (tileUrl === ESRI_WORLD_IMAGERY_TILE_URL) {
    return ESRI_WORLD_IMAGERY_ATTRIBUTION;
  }
  if (tileUrl.includes("maptiler.com")) {
    return MAP_BASEMAP_CATALOG.maptiler.attribution;
  }
  if (tileUrl.includes("stadiamaps.com")) {
    return MAP_BASEMAP_CATALOG.stadia.attribution;
  }
  return MAP_BASEMAP_CATALOG[primary].attribution;
}

export function advanceBasemapIndex(index: number, chainLength: number): number | null {
  if (index < 0 || chainLength <= 1) {
    return null;
  }
  const next = index + 1;
  return next < chainLength ? next : null;
}
