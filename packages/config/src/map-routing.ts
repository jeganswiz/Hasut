export const MAP_ROUTE_PROVIDERS = ["maptiler", "stadia", "osrm"] as const;
export type MapRouteProvider = (typeof MAP_ROUTE_PROVIDERS)[number];

export interface MapRoutePoint {
  latitude: number;
  longitude: number;
}

export interface MapRouteLeg {
  provider: MapRouteProvider;
  distanceMeters: number;
  durationSeconds: number;
  /** Road line as [longitude, latitude]. The end is the public pin, not a private point. */
  coordinates: Array<[number, number]>;
}

/** Keyed routers first, then the public router so a tile fallback still has a path. */
export function mapRouteProviderOrder(input: {
  maptilerApiKey?: string;
  stadiaApiKey?: string;
}): MapRouteProvider[] {
  const order: MapRouteProvider[] = [];
  if ((input.maptilerApiKey ?? "").trim().length > 0) {
    order.push("maptiler");
  }
  if ((input.stadiaApiKey ?? "").trim().length > 0) {
    order.push("stadia");
  }
  order.push("osrm");
  return order;
}

export function mapRouteUrl(
  provider: MapRouteProvider,
  origin: MapRoutePoint,
  destination: MapRoutePoint,
  keys: { maptilerApiKey?: string; stadiaApiKey?: string },
): string {
  const path = `${coord(origin)};${coord(destination)}`;
  if (provider === "maptiler") {
    const key = encodeURIComponent(keys.maptilerApiKey ?? "");
    return `https://api.maptiler.com/routes/driving/${path}?key=${key}&geometries=geojson&overview=full`;
  }
  if (provider === "stadia") {
    const key = encodeURIComponent(keys.stadiaApiKey ?? "");
    return `https://api.stadiamaps.com/route/v1/driving/${path}?api_key=${key}&geometries=geojson&overview=full`;
  }
  return `https://router.project-osrm.org/route/v1/driving/${path}?geometries=geojson&overview=full`;
}

export function parseMapRouteResponse(
  provider: MapRouteProvider,
  body: unknown,
): MapRouteLeg | null {
  if (provider === "maptiler") {
    return parseGeoJsonRoute(provider, body) ?? parseOsrmRoute(provider, body);
  }
  return parseOsrmRoute(provider, body) ?? parseGeoJsonRoute(provider, body);
}

export async function fetchMapRoute(input: {
  origin: MapRoutePoint;
  destination: MapRoutePoint;
  maptilerApiKey?: string;
  stadiaApiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<MapRouteLeg | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const keys = {
    maptilerApiKey: input.maptilerApiKey,
    stadiaApiKey: input.stadiaApiKey,
  };
  for (const provider of mapRouteProviderOrder(keys)) {
    const url = mapRouteUrl(provider, input.origin, input.destination, keys);
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) {
        continue;
      }
      const body: unknown = await response.json();
      const leg = parseMapRouteResponse(provider, body);
      if (leg !== null) {
        return leg;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function coord(point: MapRoutePoint): string {
  return `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`;
}

function parseOsrmRoute(provider: MapRouteProvider, body: unknown): MapRouteLeg | null {
  if (!isRecord(body) || body.code !== "Ok" || !Array.isArray(body.routes)) {
    return null;
  }
  const route = body.routes[0];
  if (!isRecord(route) || !isRecord(route.geometry)) {
    return null;
  }
  return legFromNumbers(provider, route.distance, route.duration, route.geometry.coordinates);
}

function parseGeoJsonRoute(provider: MapRouteProvider, body: unknown): MapRouteLeg | null {
  if (!isRecord(body) || !Array.isArray(body.features)) {
    return null;
  }
  const feature = body.features[0];
  if (!isRecord(feature) || !isRecord(feature.geometry) || !isRecord(feature.properties)) {
    return null;
  }
  return legFromNumbers(
    provider,
    feature.properties.distance,
    feature.properties.duration,
    feature.geometry.coordinates,
  );
}

function legFromNumbers(
  provider: MapRouteProvider,
  distance: unknown,
  duration: unknown,
  coordinates: unknown,
): MapRouteLeg | null {
  const line = normalizeLine(coordinates);
  if (
    line.length < 2 ||
    typeof distance !== "number" ||
    !Number.isFinite(distance) ||
    typeof duration !== "number" ||
    !Number.isFinite(duration)
  ) {
    return null;
  }
  return {
    provider,
    distanceMeters: distance,
    durationSeconds: duration,
    coordinates: line.slice(0, 4_000),
  };
}

function normalizeLine(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) {
    return [];
  }
  const line: Array<[number, number]> = [];
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length < 2) {
      continue;
    }
    const longitude = pair[0];
    const latitude = pair[1];
    if (
      typeof longitude !== "number" ||
      typeof latitude !== "number" ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude)
    ) {
      continue;
    }
    line.push([longitude, latitude]);
  }
  return line;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
