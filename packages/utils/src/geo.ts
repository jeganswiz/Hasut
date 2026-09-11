export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface SnappedCell extends GeoPoint {
  cellId: string;
}

const METERS_PER_DEGREE_LAT = 111_320;

export function isValidWgs84(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function snapToGrid(point: GeoPoint, cellSizeMeters: number): SnappedCell {
  const latStep = cellSizeMeters / METERS_PER_DEGREE_LAT;
  const lngMeters = METERS_PER_DEGREE_LAT * Math.cos((point.latitude * Math.PI) / 180);
  const lngStep = cellSizeMeters / Math.max(lngMeters, 1);
  const latIndex = Math.round(point.latitude / latStep);
  const lngIndex = Math.round(point.longitude / lngStep);
  return {
    latitude: latIndex * latStep,
    longitude: lngIndex * lngStep,
    cellId: `${latIndex}:${lngIndex}`,
  };
}

export function cellNeighborhood(
  point: GeoPoint,
  cellSizeMeters: number,
  radiusMeters: number,
): string[] {
  const origin = snapToGrid(point, cellSizeMeters);
  const latStep = cellSizeMeters / METERS_PER_DEGREE_LAT;
  const lngMeters = METERS_PER_DEGREE_LAT * Math.cos((origin.latitude * Math.PI) / 180);
  const lngStep = cellSizeMeters / Math.max(lngMeters, 1);
  const steps = Math.max(1, Math.ceil(radiusMeters / cellSizeMeters));
  const ids = new Set<string>();
  for (let dLat = -steps; dLat <= steps; dLat += 1) {
    for (let dLng = -steps; dLng <= steps; dLng += 1) {
      const neighbor = snapToGrid(
        {
          latitude: origin.latitude + dLat * latStep,
          longitude: origin.longitude + dLng * lngStep,
        },
        cellSizeMeters,
      );
      ids.add(neighbor.cellId);
    }
  }
  return [...ids];
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const earth = 6_371_000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function containsExactCoordinateKeys(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  const json = JSON.stringify(value);
  return /"latitude"|"longitude"|"exact"/.test(json);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
