import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Patrons are a member's accepted connections — HASUT's word for the mutual,
 * consented relationship, from חסות (patronage). It is deliberately not a
 * "follower" list: there is no one-way subscribe, so the set is symmetric.
 *
 * Audience checks read from here rather than querying connections inline, so
 * there is a single definition to audit.
 */
@Injectable()
export class PatronsService {
  constructor(private readonly prisma: PrismaService) {}

  /** True when `viewerId` is a Patron of `ownerId`. A member is their own. */
  async isPatronOf(ownerId: string, viewerId: string): Promise<boolean> {
    if (ownerId === viewerId) {
      return true;
    }
    const row = await this.prisma.connection.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: ownerId, addresseeId: viewerId },
          { requesterId: viewerId, addresseeId: ownerId },
        ],
      },
      select: { id: true },
    });
    return row !== null;
  }

  async countFor(memberId: string): Promise<number> {
    return this.prisma.connection.count({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: memberId }, { addresseeId: memberId }],
      },
    });
  }

  /**
   * Of `ownerIds`, the ones `viewerId` is a Patron of. Used by the map so a
   * screen full of pins costs one query instead of one per pin.
   */
  async patronOwnersAmong(ownerIds: readonly string[], viewerId: string): Promise<Set<string>> {
    const others = ownerIds.filter((id) => id !== viewerId);
    const patrons = new Set<string>(ownerIds.includes(viewerId) ? [viewerId] : []);
    if (others.length === 0) {
      return patrons;
    }
    const rows = await this.prisma.connection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: viewerId, addresseeId: { in: others } },
          { addresseeId: viewerId, requesterId: { in: others } },
        ],
      },
      select: { requesterId: true, addresseeId: true },
    });
    for (const row of rows) {
      patrons.add(row.requesterId === viewerId ? row.addresseeId : row.requesterId);
    }
    return patrons;
  }
}
