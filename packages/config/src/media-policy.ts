export interface MediaPolicy {
  avatarMaxBytes: number;
  allowedMimeTypes: string[];
  presignTtlSeconds: number;
}

export const MEDIA_POLICY_CONFIG_KEY = "media.policy";

/** Seed / fallback values owned by configuration, not media use-cases. */
export const MEDIA_POLICY_DEFAULTS: MediaPolicy = {
  avatarMaxBytes: 5_242_880,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  presignTtlSeconds: 300,
};

export function isMediaPolicy(value: unknown): value is MediaPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.avatarMaxBytes === "number" &&
    typeof record.presignTtlSeconds === "number" &&
    Array.isArray(record.allowedMimeTypes) &&
    record.allowedMimeTypes.every((item) => typeof item === "string")
  );
}
