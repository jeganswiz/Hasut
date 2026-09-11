import type { NotificationView, UnreadCountView } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationWriter } from "../realtime/notification-writer";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: NotificationWriter,
  ) {}

  async notify(
    memberId: string,
    templateKey: string,
    payload: Record<string, string>,
  ): Promise<NotificationView | null> {
    return this.writer.notify(memberId, templateKey, payload);
  }

  async list(memberId: string): Promise<NotificationView[]> {
    const rows = await this.prisma.notification.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((row) => this.toView(row));
  }

  async unreadCount(memberId: string): Promise<UnreadCountView> {
    const [notifications, messages] = await Promise.all([
      this.prisma.notification.count({ where: { memberId, readAt: null } }),
      this.prisma.message.count({
        where: {
          senderId: { not: memberId },
          conversation: { participants: { some: { memberId } } },
          reads: { none: { memberId } },
        },
      }),
    ]);
    return { notifications, messages };
  }

  async markRead(memberId: string, notificationId: string): Promise<NotificationView> {
    const row = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (row === null || row.memberId !== memberId) {
      throw new HasutHttpException("NOT_FOUND", "Notification not found", HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: row.readAt ?? new Date() },
    });
    return this.toView(updated);
  }

  async markAllRead(memberId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { memberId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private toView(row: {
    id: string;
    templateKey: string;
    title: string;
    body: string;
    payloadJson: Prisma.JsonValue;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationView {
    return {
      id: row.id,
      templateKey: row.templateKey,
      title: row.title,
      body: row.body,
      payload: asStringRecord(row.payloadJson),
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function asStringRecord(value: Prisma.JsonValue): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item;
    }
  }
  return result;
}
