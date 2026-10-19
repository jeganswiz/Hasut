import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { NotificationView } from "@hasut/types";
import { PrismaService } from "../prisma/prisma.service";
import { PushDispatchService } from "./push-dispatch.service";
import { RealtimeEvents } from "./realtime.events";

export interface NotifyOptions {
  dedupeKey?: string;
}

@Injectable()
export class NotificationWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEvents,
    private readonly push: PushDispatchService,
  ) {}

  async notify(
    memberId: string,
    templateKey: string,
    payload: Record<string, string>,
    options: NotifyOptions = {},
  ): Promise<NotificationView | null> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { memberId_key: { memberId, key: templateKey } },
    });
    if (preference !== null && !preference.enabled) {
      return null;
    }
    if (await this.suppressed(memberId)) {
      return null;
    }
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { key: templateKey },
    });
    if (template === null || !template.isActive) {
      return null;
    }
    let created;
    try {
      created = await this.prisma.notification.create({
        data: {
          memberId,
          templateKey,
          title: renderTemplate(template.titleTemplate, payload),
          body: renderTemplate(template.bodyTemplate, payload),
          payloadJson: payload as Prisma.InputJsonValue,
          dedupeKey: options.dedupeKey,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    }
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
    await this.push.send(memberId, view);
    return view;
  }

  private async suppressed(memberId: string): Promise<boolean> {
    const settings = await this.prisma.notificationSettings.findUnique({ where: { memberId } });
    if (settings === null) {
      return false;
    }
    if (inQuietHours(new Date(), settings.quietHoursStartMinutes, settings.quietHoursEndMinutes)) {
      return true;
    }
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.notification.count({
      where: { memberId, createdAt: { gt: hourAgo } },
    });
    return recent >= settings.maxPerHour;
  }
}

export function inQuietHours(
  now: Date,
  startMinutes: number | null,
  endMinutes: number | null,
): boolean {
  if (startMinutes === null || endMinutes === null) {
    return false;
  }
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (startMinutes === endMinutes) {
    return false;
  }
  if (startMinutes < endMinutes) {
    return minutes >= startMinutes && minutes < endMinutes;
  }
  return minutes >= startMinutes || minutes < endMinutes;
}

function renderTemplate(template: string, payload: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => payload[key] ?? "");
}
