export const REQUEST_ID_HEADER = "x-request-id";

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "OTP_EXPIRED",
  "OTP_INVALID",
  "OTP_ATTEMPTS_EXCEEDED",
  "OTP_RESEND_COOLDOWN",
  "SESSION_REVOKED",
  "REFRESH_REUSE",
  "ACCOUNT_SUSPENDED",
  "NOT_CONNECTED",
  "MEDIA_REJECTED",
  "LOCATION_PERMISSION_DENIED",
  "LOCATION_UNAVAILABLE",
  "FEATURE_DISABLED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type AppEnvironment = "development" | "staging" | "production" | "test";

export interface ApiPaginationMeta {
  cursor: string;
  hasMore: boolean;
}

export interface ApiMeta {
  requestId: string;
  pagination?: ApiPaginationMeta;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
  meta: ApiMeta;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, requestId: string, pagination?: ApiPaginationMeta): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta: pagination ? { requestId, pagination } : { requestId },
  };
}

export function fail(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
): ApiFailure {
  return {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
    meta: { requestId },
  };
}

export function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("success" in value) || !("meta" in value)) {
    return false;
  }
  const candidate = value as { success: unknown; meta: unknown };
  if (typeof candidate.success !== "boolean") {
    return false;
  }
  if (typeof candidate.meta !== "object" || candidate.meta === null) {
    return false;
  }
  return "requestId" in candidate.meta;
}
