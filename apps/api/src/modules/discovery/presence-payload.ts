import type { DiscoveryMarker } from "@hasut/types";
import { initialsFromName } from "@hasut/utils";

export function cellRoom(cellId: string): string {
  return `cell:${cellId}`;
}

export function buildMemberPresenceMarker(input: {
  memberId: string;
  displayName: string;
  pinLat: number;
  pinLng: number;
  rating: number | null;
  photoUrl?: string | null;
  available?: boolean;
}): DiscoveryMarker {
  return {
    id: input.memberId,
    kind: "MEMBER",
    label: input.displayName,
    rating: input.rating,
    selected: false,
    pinLat: input.pinLat,
    pinLng: input.pinLng,
    photoUrl: input.photoUrl ?? null,
    initials: initialsFromName(input.displayName),
    available: input.available ?? false,
    ring: input.available ? "available" : "idle",
    pinMediaKind: "PROFILE",
    previewHlsUrl: null,
  };
}
