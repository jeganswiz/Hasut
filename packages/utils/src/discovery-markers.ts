export interface PresencePin {
  id: string;
  pinLat: number;
  pinLng: number;
  label: string;
  rating: number | null;
}

export function mergePresenceMarker<T extends PresencePin>(markers: T[], incoming: T): T[] {
  const index = markers.findIndex((marker) => marker.id === incoming.id);
  if (index < 0) {
    return markers;
  }
  return markers.map((marker, current) =>
    current === index
      ? {
          ...marker,
          pinLat: incoming.pinLat,
          pinLng: incoming.pinLng,
          label: incoming.label,
          rating: incoming.rating,
        }
      : marker,
  );
}

export function diffDiscoveryMarkers<T extends { id: string }>(
  previousIds: readonly string[],
  nextMarkers: readonly T[],
): { add: T[]; update: T[]; remove: string[] } {
  const nextById = new Map(nextMarkers.map((marker) => [marker.id, marker]));
  const previous = new Set(previousIds);
  const add: T[] = [];
  const update: T[] = [];
  const remove: string[] = [];
  for (const marker of nextMarkers) {
    if (previous.has(marker.id)) {
      update.push(marker);
    } else {
      add.push(marker);
    }
  }
  for (const id of previousIds) {
    if (!nextById.has(id)) {
      remove.push(id);
    }
  }
  return { add, update, remove };
}
