import type { DiscoveryMarker } from "@hasut/types";

export function cellRoom(cellId: string): string {
  return `cell:${cellId}`;
}

export function buildMemberPresenceMarker(input: {
  memberId: string;
  displayName: string;
  pinLat: number;
  pinLng: number;
  rating: number | null;
}): DiscoveryMarker {
  return {
    id: input.memberId,
    kind: "MEMBER",
    label: input.displayName,
    rating: input.rating,
    selected: false,
    pinLat: input.pinLat,
    pinLng: input.pinLng,
  };
}
