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
export { coerceEmail, isEmail, maskEmail, maskPhone, normalizeEmail } from "./email";
export { coercePhoneE164, isE164Phone, normalizePhoneE164 } from "./phone";
export { passwordStrength, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password";
export type { PasswordStrength } from "./password";
export { createRequestId, isUuidV4, normalizeRequestId } from "./request-id";
export { isNonEmptyString, initialsFromName, slugify, splitCsv } from "./strings";
