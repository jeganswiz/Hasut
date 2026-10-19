import { Injectable } from "@nestjs/common";

/**
 * Who is watching which live right now. Counts distinct members, so a viewer
 * with two tabs is one person. The live gateway feeds this; services read it.
 * Process-local: with several API nodes the Redis adapter (L8) shares rooms,
 * and the persisted peak/total counters remain the authoritative history.
 */
@Injectable()
export class LiveViewerRegistry {
  private readonly rooms = new Map<string, Map<string, number>>();

  /** Returns the distinct viewer count after joining. */
  join(liveId: string, memberId: string): number {
    const room = this.rooms.get(liveId) ?? new Map<string, number>();
    room.set(memberId, (room.get(memberId) ?? 0) + 1);
    this.rooms.set(liveId, room);
    return room.size;
  }

  /** Returns the distinct viewer count after leaving. */
  leave(liveId: string, memberId: string): number {
    const room = this.rooms.get(liveId);
    if (room === undefined) {
      return 0;
    }
    const sockets = room.get(memberId) ?? 0;
    if (sockets <= 1) {
      room.delete(memberId);
    } else {
      room.set(memberId, sockets - 1);
    }
    if (room.size === 0) {
      this.rooms.delete(liveId);
    }
    return room.size;
  }

  count(liveId: string): number {
    return this.rooms.get(liveId)?.size ?? 0;
  }

  viewers(liveId: string): string[] {
    return [...(this.rooms.get(liveId)?.keys() ?? [])];
  }

  isWatching(liveId: string, memberId: string): boolean {
    return this.rooms.get(liveId)?.has(memberId) ?? false;
  }

  clear(liveId: string): void {
    this.rooms.delete(liveId);
  }
}
