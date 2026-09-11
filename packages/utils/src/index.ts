export { bucketDistanceMeters, formatDistanceLabel } from "./distance";
export {
  containsExactCoordinateKeys,
  cellNeighborhood,
  haversineMeters,
  isValidWgs84,
  snapToGrid,
} from "./geo";
export type { GeoPoint, SnappedCell } from "./geo";
export { diffDiscoveryMarkers, mergePresenceMarker } from "./discovery-markers";
export { shouldAcceptLocationFix, shouldRefreshNearby } from "./presence-gate";
export { coercePhoneE164, isE164Phone, normalizePhoneE164 } from "./phone";
export { createRequestId, isUuidV4, normalizeRequestId } from "./request-id";
export { isNonEmptyString, slugify, splitCsv } from "./strings";
