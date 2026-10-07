export interface MediaPolicy {
  avatarMaxBytes: number;
  allowedMimeTypes: string[];
  presignTtlSeconds: number;
}

export const MEDIA_POLICY_CONFIG_KEY = "media.policy";

/** Seed / fallback values owned by configuration, not media use-cases. */
export const MEDIA_POLICY_DEFAULTS: MediaPolicy = {
  avatarMaxBytes: 5_242_880,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/bmp",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "image/jpg",
    "image/tiff",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "audio/mpeg",
    "audio/mp4",
    "audio/webm",
    "audio/aac",
    "audio/wav",
    "audio/x-wav",
    "audio/x-m4a",
  ],
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

/**
 * Keeps an operator's size limits and any extra types they added, and always
 * includes the current default types so a stored policy from an older release
 * does not keep blocking iPhone photos and movies.
 */
export function readMediaPolicy(value: unknown): MediaPolicy {
  if (!isMediaPolicy(value)) {
    return {
      ...MEDIA_POLICY_DEFAULTS,
      allowedMimeTypes: [...MEDIA_POLICY_DEFAULTS.allowedMimeTypes],
    };
  }
  const allowed = new Set(value.allowedMimeTypes);
  for (const mime of MEDIA_POLICY_DEFAULTS.allowedMimeTypes) {
    allowed.add(mime);
  }
  return {
    avatarMaxBytes: value.avatarMaxBytes,
    presignTtlSeconds: value.presignTtlSeconds,
    allowedMimeTypes: [...allowed],
  };
}
