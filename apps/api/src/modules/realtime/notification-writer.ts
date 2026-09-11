import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { NotificationView } from "@hasut/types";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEvents } from "./realtime.events";

@Injectable()
export class NotificationWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEvents,
  ) {}

  async notify(
    memberId: string,
    templateKey: string,
    payload: Record<string, string>,
  ): Promise<NotificationView | null> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { memberId_key: { memberId, key: templateKey } },
    });
    if (preference !== null && !preference.enabled) {
      return null;
    }
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { key: templateKey },
    });
    if (template === null || !template.isActive) {
      return null;
    }
    const created = await this.prisma.notification.create({
      data: {
        memberId,
        templateKey,
        title: renderTemplate(template.titleTemplate, payload),
        body: renderTemplate(template.bodyTemplate, payload),
        payloadJson: payload as Prisma.InputJsonValue,
      },
    });
    const view: NotificationView = {
      id: created.id,
      templateKey: created.templateKey,
      title: created.title,
      body: created.body,
      payload,
      readAt: created.readAt?.toISOString() ?? null,
      createdAt: created.createdAt.toISOString(),
    };
    this.realtime.publish([memberId], "notification.created", view);
    return view;
  }
}

function renderTemplate(template: string, payload: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => payload[key] ?? "");
}
