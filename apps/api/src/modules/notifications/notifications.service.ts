import type {
  MemberRole,
  NotificationTemplateView,
  NotificationView,
  UnreadCountView,
} from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { assertAdminRole } from "../../common/auth/staff-auth";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationWriter } from "../realtime/notification-writer";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: NotificationWriter,
    private readonly audit: AuditService,
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

  async listTemplates(roles: readonly MemberRole[]): Promise<NotificationTemplateView[]> {
    assertAdminRole(roles);
    const rows = await this.prisma.notificationTemplate.findMany({
      orderBy: { key: "asc" },
    });
    return rows.map((row) => this.toTemplate(row));
  }

  async updateTemplate(
    actorId: string,
    roles: readonly MemberRole[],
    templateId: string,
    input: { titleTemplate: string; bodyTemplate: string; isActive?: boolean },
    requestId: string,
  ): Promise<NotificationTemplateView> {
    assertAdminRole(roles);
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });
    if (existing === null) {
      throw new HasutHttpException(
        "NOT_FOUND",
        "Notification template not found",
        HttpStatus.NOT_FOUND,
      );
    }
    const updated = await this.prisma.notificationTemplate.update({
      where: { id: templateId },
      data: {
        titleTemplate: input.titleTemplate,
        bodyTemplate: input.bodyTemplate,
        isActive: input.isActive ?? existing.isActive,
      },
    });
    await this.audit.record({
      actorId,
      action: "NOTIFICATION_TEMPLATE_UPDATED",
      entity: "notification_template",
      entityId: templateId,
      requestId,
      afterJson: { key: updated.key, isActive: updated.isActive },
    });
    return this.toTemplate(updated);
  }

  private toTemplate(row: {
    id: string;
    key: string;
    channel: "IN_APP";
    titleTemplate: string;
    bodyTemplate: string;
    isActive: boolean;
  }): NotificationTemplateView {
    return {
      id: row.id,
      key: row.key,
      channel: "IN_APP",
      titleTemplate: row.titleTemplate,
      bodyTemplate: row.bodyTemplate,
      isActive: row.isActive,
    };
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
