import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NotificationView } from "@hasut/types";
import type { ApiEnv } from "../../config/env";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Delivers an in-app notification over Web Push when VAPID keys are configured.
 * Missing keys leave push off so local and test environments stay quiet.
 */
@Injectable()
export class PushDispatchService {
  private readonly logger = new Logger(PushDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApiEnv, true>,
  ) {}

  available(): boolean {
    return (
      this.config.get("VAPID_PUBLIC_KEY", { infer: true }).trim().length > 0 &&
      this.config.get("VAPID_PRIVATE_KEY", { infer: true }).trim().length > 0
    );
  }

  publicKey(): string {
    return this.config.get("VAPID_PUBLIC_KEY", { infer: true }).trim();
  }

  async send(memberId: string, view: NotificationView): Promise<void> {
    if (!this.available()) {
      return;
    }
    const rows = await this.prisma.pushSubscription.findMany({ where: { memberId } });
    if (rows.length === 0) {
      return;
    }
    let webPush: typeof import("web-push");
    try {
      webPush = await import("web-push");
    } catch {
      this.logger.warn("web-push is not installed; skip delivery");
      return;
    }
    webPush.setVapidDetails(
      this.config.get("VAPID_SUBJECT", { infer: true }),
      this.publicKey(),
      this.config.get("VAPID_PRIVATE_KEY", { infer: true }),
    );
    const payload = JSON.stringify({
      title: view.title,
      body: view.body,
      url: view.payload.liveId !== undefined ? `/live/${view.payload.liveId}` : "/notifications",
    });
    for (const row of rows) {
      try {
        await webPush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.prisma.pushSubscription
            .delete({ where: { id: row.id } })
            .catch(() => undefined);
        }
      }
    }
  }
}
