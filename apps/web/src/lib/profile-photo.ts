const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function acceptedAvatarType(mimeType: string): boolean {
  return AVATAR_TYPES.has(mimeType);
}
