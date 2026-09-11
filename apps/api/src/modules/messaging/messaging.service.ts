import type { ConversationView, MessagePage, MessageView } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Message } from "@prisma/client";
import { decodeTimeIdCursor, encodeTimeIdCursor } from "../../common/pagination/cursor";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { ConfigurationService } from "../configuration/configuration.service";
import { ConnectionsService } from "../connections/connections.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { NotificationWriter } from "../realtime/notification-writer";
import { RealtimeEvents } from "../realtime/realtime.events";
import { ReportsService } from "../reports/reports.service";

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: ConnectionsService,
    private readonly reports: ReportsService,
    private readonly media: MediaService,
    private readonly profiles: ProfilesService,
    private readonly configuration: ConfigurationService,
    private readonly notifications: NotificationWriter,
    private readonly realtime: RealtimeEvents,
  ) {}

  async listConversations(memberId: string): Promise<ConversationView[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { memberId } } },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { reads: true } },
        connection: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return Promise.all(rows.map((row) => this.toConversationView(row, memberId)));
  }

  async getConversation(memberId: string, conversationId: string): Promise<ConversationView> {
    const row = await this.requireParticipant(memberId, conversationId);
    const last = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      include: { reads: true },
    });
    return this.toConversationView({ ...row, messages: last === null ? [] : [last] }, memberId);
  }

  async listMessages(
    memberId: string,
    conversationId: string,
    cursor?: string,
  ): Promise<MessagePage> {
    await this.requireParticipant(memberId, conversationId);
    const policy = await this.configuration.getMessagingPolicy();
    const decoded = cursor === undefined ? null : decodeTimeIdCursor(cursor);
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(decoded === null
          ? {}
          : {
              OR: [
                { createdAt: { lt: new Date(decoded.createdAt) } },
                { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
              ],
            }),
      },
      include: { reads: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: policy.pageSize + 1,
    });
    const page = rows.slice(0, policy.pageSize);
    const items = await Promise.all(page.map((row) => this.toMessageView(row)));
    const last = page[page.length - 1];
    return {
      items: items.reverse(),
      nextCursor:
        rows.length > policy.pageSize && last !== undefined
          ? encodeTimeIdCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async send(
    memberId: string,
    conversationId: string,
    input: { type: "TEXT" | "IMAGE"; body?: string; mediaId?: string },
  ): Promise<MessageView> {
    const conversation = await this.requireParticipant(memberId, conversationId);
    const peerId = conversation.participants.find((item) => item.memberId !== memberId)?.memberId;
    if (peerId === undefined) {
      throw new HasutHttpException(
        "NOT_FOUND",
        "Conversation peer not found",
        HttpStatus.NOT_FOUND,
      );
    }
    await this.connections.requireAcceptedPair(memberId, peerId);
    await this.reports.assertNotBlocked(memberId, peerId);
    const policy = await this.configuration.getMessagingPolicy();
    if (input.type === "TEXT") {
      const body = input.body ?? "";
      if (body.length === 0 || body.length > policy.maxTextChars) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Message text is invalid",
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    if (input.type === "IMAGE") {
      if (input.mediaId === undefined) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Image attachment is required",
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.media.requireReadyChatImage(memberId, input.mediaId);
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId: memberId,
          type: input.type,
          body: input.type === "TEXT" ? (input.body ?? null) : null,
          mediaId: input.type === "IMAGE" ? (input.mediaId ?? null) : null,
        },
        include: { reads: true },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return message;
    });
    const view = await this.toMessageView(created);
    this.realtime.publish([memberId, peerId], "message.created", view);
    const actor = await this.profiles.getPreview(memberId);
    await this.notifications.notify(peerId, "message.received", {
      actorName: actor.displayName,
      actorId: memberId,
      conversationId,
    });
    return view;
  }

  async markRead(
    memberId: string,
    conversationId: string,
    messageId: string,
  ): Promise<{ updated: number }> {
    await this.requireParticipant(memberId, conversationId);
    const target = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (target === null || target.conversationId !== conversationId) {
      throw new HasutHttpException("NOT_FOUND", "Message not found", HttpStatus.NOT_FOUND);
    }
    const unread = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: memberId },
        createdAt: { lte: target.createdAt },
        reads: { none: { memberId } },
      },
      select: { id: true },
    });
    if (unread.length > 0) {
      await this.prisma.messageRead.createMany({
        data: unread.map((row) => ({ messageId: row.id, memberId })),
        skipDuplicates: true,
      });
    }
    const payload = { conversationId, messageId, readerId: memberId };
    const peer = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
    });
    this.realtime.publish(
      peer.map((item) => item.memberId),
      "message.read",
      payload,
    );
    return { updated: unread.length };
  }

  private async requireParticipant(memberId: string, conversationId: string) {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true, connection: true },
    });
    if (row === null || !row.participants.some((item) => item.memberId === memberId)) {
      throw new HasutHttpException("NOT_FOUND", "Conversation not found", HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async toConversationView(
    row: {
      id: string;
      updatedAt: Date;
      participants: Array<{ memberId: string }>;
      messages?: Array<Message & { reads: Array<{ memberId: string; readAt: Date }> }>;
    },
    viewerId: string,
  ): Promise<ConversationView> {
    const peerId =
      row.participants.find((item) => item.memberId !== viewerId)?.memberId ?? viewerId;
    const last = row.messages?.[0];
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: row.id,
        senderId: { not: viewerId },
        reads: { none: { memberId: viewerId } },
      },
    });
    return {
      id: row.id,
      peer: await this.profiles.getPreview(peerId),
      lastMessage: last === undefined ? null : await this.toMessageView(last),
      unreadCount,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async toMessageView(
    row: Message & { reads?: Array<{ memberId: string; readAt: Date }> },
  ): Promise<MessageView> {
    const reads = row.reads ?? [];
    const recipientRead = reads.find((item) => item.memberId !== row.senderId);
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      type: row.type,
      body: row.body,
      mediaUrl: await this.media.photoUrl(row.mediaId),
      createdAt: row.createdAt.toISOString(),
      readAt: recipientRead?.readAt.toISOString() ?? null,
    };
  }
}
