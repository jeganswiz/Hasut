export function hasStoryRing(kind: string | null | undefined): boolean {
  return kind === "IMAGE" || kind === "VIDEO" || kind === "LIVE";
}
