import type { ConnectionView } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Connection } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { NotificationWriter } from "../realtime/notification-writer";
import { RealtimeEvents } from "../realtime/realtime.events";

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly notifications: NotificationWriter,
    private readonly realtime: RealtimeEvents,
  ) {}

  async request(actorId: string, addresseeId: string): Promise<ConnectionView> {
    if (actorId === addresseeId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "You cannot connect with yourself",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.requireActiveMember(addresseeId);
    await this.assertNotBlocked(actorId, addresseeId);
    const pairKey = canonicalPairKey(actorId, addresseeId);
    const existing = await this.prisma.connection.findUnique({ where: { pairKey } });
    if (existing !== null) {
      if (existing.status === "ACCEPTED") {
        throw new HasutHttpException("CONFLICT", "You are already connected", HttpStatus.CONFLICT);
      }
      if (existing.status === "PENDING") {
        if (existing.requesterId === actorId) {
          return this.toView(existing, actorId);
        }
        throw new HasutHttpException(
          "CONFLICT",
          "A connection request is already pending",
          HttpStatus.CONFLICT,
        );
      }
      const reused = await this.prisma.connection.update({
        where: { id: existing.id },
        data: { requesterId: actorId, addresseeId, status: "PENDING" },
      });
      await this.emitRequested(actorId, addresseeId, reused);
      return this.toView(reused, actorId);
    }

    const created = await this.prisma.connection.create({
      data: { requesterId: actorId, addresseeId, pairKey, status: "PENDING" },
    });
    await this.emitRequested(actorId, addresseeId, created);
    return this.toView(created, actorId);
  }

  async accept(actorId: string, connectionId: string): Promise<ConnectionView> {
    const row = await this.requireConnection(connectionId);
    if (row.addresseeId !== actorId) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "Only the addressee can accept",
        HttpStatus.FORBIDDEN,
      );
    }
    await this.assertNotBlocked(row.requesterId, row.addresseeId);
    if (row.status === "ACCEPTED") {
      return this.toView(row, actorId);
    }
    if (row.status !== "PENDING") {
      throw new HasutHttpException(
        "CONFLICT",
        "This request cannot be accepted",
        HttpStatus.CONFLICT,
      );
    }
    const accepted = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.connection.update({
        where: { id: row.id },
        data: { status: "ACCEPTED" },
      });
      await tx.conversation.upsert({
        where: { connectionId: row.id },
        create: {
          connectionId: row.id,
          participants: {
            createMany: {
              data: [{ memberId: row.requesterId }, { memberId: row.addresseeId }],
            },
          },
        },
        update: {},
      });
      return updated;
    });
    const actor = await this.profiles.getPreview(actorId);
    await this.notifications.notify(row.requesterId, "connection.accepted", {
      actorName: actor.displayName,
      actorId,
    });
    const view = await this.toView(accepted, actorId);
    this.realtime.publish([row.requesterId, row.addresseeId], "connection.updated", view);
    return view;
  }

  async reject(actorId: string, connectionId: string): Promise<ConnectionView> {
    const row = await this.requireConnection(connectionId);
    if (row.addresseeId !== actorId) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "Only the addressee can reject",
        HttpStatus.FORBIDDEN,
      );
    }
    if (row.status !== "PENDING") {
      throw new HasutHttpException(
        "CONFLICT",
        "This request cannot be rejected",
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.connection.update({
      where: { id: row.id },
      data: { status: "REJECTED" },
    });
    const view = await this.toView(updated, actorId);
    this.realtime.publish([row.requesterId, row.addresseeId], "connection.updated", view);
    return view;
  }

  async cancel(actorId: string, connectionId: string): Promise<ConnectionView> {
    const row = await this.requireConnection(connectionId);
    if (row.requesterId !== actorId) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "Only the requester can cancel",
        HttpStatus.FORBIDDEN,
      );
    }
    if (row.status !== "PENDING") {
      throw new HasutHttpException(
        "CONFLICT",
        "This request cannot be cancelled",
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.connection.update({
      where: { id: row.id },
      data: { status: "CANCELLED" },
    });
    const view = await this.toView(updated, actorId);
    this.realtime.publish([row.requesterId, row.addresseeId], "connection.updated", view);
    return view;
  }

  async list(actorId: string): Promise<ConnectionView[]> {
    const rows = await this.prisma.connection.findMany({
      where: { OR: [{ requesterId: actorId }, { addresseeId: actorId }] },
      orderBy: { updatedAt: "desc" },
    });
    return Promise.all(rows.map((row) => this.toView(row, actorId)));
  }

  async getWith(actorId: string, peerId: string): Promise<{ connection: ConnectionView | null }> {
    const row = await this.prisma.connection.findUnique({
      where: { pairKey: canonicalPairKey(actorId, peerId) },
    });
    return { connection: row === null ? null : await this.toView(row, actorId) };
  }

  async requireAcceptedPair(memberA: string, memberB: string): Promise<Connection> {
    const row = await this.prisma.connection.findUnique({
      where: { pairKey: canonicalPairKey(memberA, memberB) },
    });
    if (row === null || row.status !== "ACCEPTED") {
      throw new HasutHttpException(
        "NOT_CONNECTED",
        "You can only message accepted connections",
        HttpStatus.FORBIDDEN,
      );
    }
    return row;
  }

  private async emitRequested(
    actorId: string,
    addresseeId: string,
    row: Connection,
  ): Promise<void> {
    const actor = await this.profiles.getPreview(actorId);
    await this.notifications.notify(addresseeId, "connection.requested", {
      actorName: actor.displayName,
      actorId,
    });
    this.realtime.publish(
      [actorId, addresseeId],
      "connection.updated",
      await this.toView(row, addresseeId),
    );
  }

  private async assertNotBlocked(memberA: string, memberB: string): Promise<void> {
    const blocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: memberA, blockedId: memberB },
          { blockerId: memberB, blockedId: memberA },
        ],
      },
    });
    if (blocked !== null) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "You cannot interact with this member",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async requireConnection(connectionId: string): Promise<Connection> {
    const row = await this.prisma.connection.findUnique({ where: { id: connectionId } });
    if (row === null) {
      throw new HasutHttpException("NOT_FOUND", "Connection not found", HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async requireActiveMember(memberId: string): Promise<void> {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (member === null || member.status !== "ACTIVE") {
      throw new HasutHttpException("NOT_FOUND", "Member not found", HttpStatus.NOT_FOUND);
    }
  }

  private async toView(row: Connection, viewerId: string): Promise<ConnectionView> {
    const peerId = row.requesterId === viewerId ? row.addresseeId : row.requesterId;
    const conversation = await this.prisma.conversation.findUnique({
      where: { connectionId: row.id },
    });
    return {
      id: row.id,
      status: row.status,
      direction: row.requesterId === viewerId ? "OUTGOING" : "INCOMING",
      peer: await this.profiles.getPreview(peerId),
      conversationId: conversation?.id ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export function canonicalPairKey(memberA: string, memberB: string): string {
  return [memberA, memberB].sort().join(":");
}
