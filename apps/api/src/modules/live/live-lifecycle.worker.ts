import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { LiveNotificationsService } from "../stories/live-notifications.service";
import { LiveService } from "../stories/live.service";
import { LiveRecordingService } from "./live-recording.service";

const TICK_MS = 15_000;

/**
 * Ends LIVE sessions whose host stopped heartbeating. The idle cap lives in
 * `live.policy`, so operators can change it without a deploy.
 */
@Injectable()
export class LiveLifecycleWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveLifecycleWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configuration: ConfigurationService,
    private readonly live: LiveService,
    private readonly recording: LiveRecordingService,
    private readonly notifications: LiveNotificationsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick().catch((error) => {
        const name = error instanceof Error ? error.name : "error";
        this.logger.warn(`Idle live sweep failed (${name})`);
      });
    }, TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<number> {
    const policy = await this.configuration.getLivePolicy();
    const cutoff = new Date(Date.now() - policy.idleTimeoutSeconds * 1000);
    const stale = await this.prisma.liveSession.findMany({
      where: {
        status: "LIVE",
        OR: [
          { lastHeartbeatAt: null, startedAt: { lt: cutoff } },
          { lastHeartbeatAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
      take: 20,
    });
    let ended = 0;
    for (const row of stale) {
      const result = await this.live.endIdle(row.id);
      if (result !== null) {
        ended += 1;
      }
    }
    await this.recording.processNext().catch((error) => {
      const name = error instanceof Error ? error.name : "error";
      this.logger.warn(`Live recording sweep failed (${name})`);
    });
    await this.notifications.remindUpcoming().catch((error) => {
      const name = error instanceof Error ? error.name : "error";
      this.logger.warn(`Live reminder sweep failed (${name})`);
    });
    return ended;
  }
}
