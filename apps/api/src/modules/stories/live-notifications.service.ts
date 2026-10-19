import { Injectable, Logger } from "@nestjs/common";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { NotificationWriter } from "../realtime/notification-writer";
import { ReportsService } from "../reports/reports.service";
import { PatronsService } from "./patrons.service";
import type { LiveRow } from "./live.service";

/**
 * In-app (+ push) fan-out for live start, scheduled reminders, and replay
 * publish. Recipients are Patrons plus Remind-me subscribers, minus blocks.
 */
@Injectable()
export class LiveNotificationsService {
  private readonly logger = new Logger(LiveNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patrons: PatronsService,
    private readonly reports: ReportsService,
    private readonly profiles: ProfilesService,
    private readonly writer: NotificationWriter,
    private readonly configuration: ConfigurationService,
  ) {}

  async notifyStarted(row: LiveRow): Promise<number> {
    const host = await this.profiles.getPreview(row.memberId);
    return this.fanout(row, "live.started", `live.started:${row.id}`, {
      liveId: row.id,
      actorName: host.displayName,
      title: row.title.length > 0 ? row.title : "Live",
    });
  }

  async notifyReplayPublished(row: LiveRow, storyId: string): Promise<number> {
    const host = await this.profiles.getPreview(row.memberId);
    return this.fanout(row, "live.replay.published", `live.replay:${storyId}`, {
      liveId: row.id,
      storyId,
      actorName: host.displayName,
      title: row.title.length > 0 ? row.title : "Replay",
    });
  }

  async remindUpcoming(): Promise<number> {
    const policy = await this.configuration.getLivePolicy();
    const now = new Date();
    const until = new Date(now.getTime() + policy.scheduleReminderMinutes * 60_000);
    const rows = await this.prisma.liveSession.findMany({
      where: {
        status: "SCHEDULED",
        reminderSentAt: null,
        scheduledFor: { gt: now, lte: until },
      },
      take: 20,
    });
    let sent = 0;
    for (const row of rows) {
      const host = await this.profiles.getPreview(row.memberId);
      sent += await this.fanout(row, "live.reminder", `live.reminder:${row.id}`, {
        liveId: row.id,
        actorName: host.displayName,
        title: row.title.length > 0 ? row.title : "Upcoming live",
      });
      await this.prisma.liveSession.update({
        where: { id: row.id },
        data: { reminderSentAt: new Date() },
      });
    }
    return sent;
  }

  async setReminder(memberId: string, creatorId: string, enabled: boolean): Promise<boolean> {
    if (memberId === creatorId) {
      return false;
    }
    if (!enabled) {
      await this.prisma.liveReminder.deleteMany({ where: { creatorId, memberId } });
      return false;
    }
    await this.prisma.liveReminder.upsert({
      where: { creatorId_memberId: { creatorId, memberId } },
      create: { creatorId, memberId },
      update: {},
    });
    return true;
  }

  async isReminded(memberId: string, creatorId: string): Promise<boolean> {
    const row = await this.prisma.liveReminder.findUnique({
      where: { creatorId_memberId: { creatorId, memberId } },
    });
    return row !== null;
  }

  private async fanout(
    row: Pick<LiveRow, "id" | "memberId" | "audience">,
    templateKey: string,
    dedupePrefix: string,
    payload: Record<string, string>,
  ): Promise<number> {
    const recipients = await this.recipients(row);
    let sent = 0;
    for (const memberId of recipients) {
      try {
        const view = await this.writer.notify(memberId, templateKey, payload, {
          dedupeKey: `${dedupePrefix}:${memberId}`,
        });
        if (view !== null) {
          sent += 1;
        }
      } catch (error) {
        const name = error instanceof Error ? error.name : "error";
        this.logger.warn(`Live notify ${templateKey} failed (${name})`);
      }
    }
    return sent;
  }

  private async recipients(row: Pick<LiveRow, "id" | "memberId" | "audience">): Promise<string[]> {
    const unique = new Set<string>();
    if (row.audience === "PRIVATE") {
      const invites = await this.prisma.liveInvite.findMany({
        where: { liveId: row.id },
        select: { memberId: true },
      });
      for (const invite of invites) {
        unique.add(invite.memberId);
      }
    } else {
      for (const id of await this.patrons.listIdsFor(row.memberId)) {
        unique.add(id);
      }
      if (row.audience === "EVERYONE") {
        const reminderRows = await this.prisma.liveReminder.findMany({
          where: { creatorId: row.memberId },
          select: { memberId: true },
        });
        for (const item of reminderRows) {
          unique.add(item.memberId);
        }
      }
    }
    unique.delete(row.memberId);
    const kept: string[] = [];
    for (const memberId of unique) {
      if (await this.reports.isBlockedEitherWay(row.memberId, memberId)) {
        continue;
      }
      kept.push(memberId);
    }
    return kept;
  }
}
