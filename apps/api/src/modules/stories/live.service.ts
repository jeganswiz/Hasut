import { randomUUID } from "node:crypto";
import type { LiveSessionView, MemberRole } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { assertModerationAccess } from "../../common/auth/staff-auth";
import type { ApiEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { StoriesService } from "./stories.service";

@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stories: StoriesService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<ApiEnv, true>,
  ) {}

  async start(memberId: string, requestId: string): Promise<LiveSessionView> {
    await this.stories.assertEnabled();
    await this.prisma.liveSession.updateMany({
      where: { memberId, status: "LIVE" },
      data: { status: "ENDED", endedAt: new Date() },
    });
    const id = randomUUID();
    const base = this.config.get("LIVE_HLS_BASE_URL", { infer: true });
    const origin = base.length > 0 ? base.replace(/\/$/, "") : "/media/hls";
    const created = await this.prisma.liveSession.create({
      data: {
        id,
        memberId,
        status: "LIVE",
        hlsUrl: `${origin}/live/${id}/index.m3u8`,
        previewHlsUrl: `${origin}/live/${id}/preview.m3u8`,
        ingestUrl: `${origin}/whip/${id}`,
      },
    });
    await this.audit.record({
      actorId: memberId,
      action: "LIVE_STARTED",
      entity: "live_session",
      entityId: created.id,
      requestId,
    });
    return this.toView(created);
  }

  async end(memberId: string, requestId: string): Promise<LiveSessionView> {
    await this.stories.assertEnabled();
    const current = await this.prisma.liveSession.findFirst({
      where: { memberId, status: "LIVE" },
      orderBy: { startedAt: "desc" },
    });
    if (current === null) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.liveSession.update({
      where: { id: current.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    await this.audit.record({
      actorId: memberId,
      action: "LIVE_ENDED",
      entity: "live_session",
      entityId: updated.id,
      requestId,
    });
    return this.toView(updated);
  }

  async listAdmin(roles: readonly MemberRole[]): Promise<LiveSessionView[]> {
    assertModerationAccess(roles);
    const rows = await this.prisma.liveSession.findMany({
      where: { status: "LIVE" },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
    return rows.map((row) => this.toView(row));
  }

  async endById(
    actorId: string,
    roles: readonly MemberRole[],
    liveId: string,
    requestId: string,
  ): Promise<LiveSessionView> {
    assertModerationAccess(roles);
    const current = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (current === null) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.liveSession.update({
      where: { id: liveId },
      data: { status: "ENDED", endedAt: new Date() },
    });
    await this.audit.record({
      actorId,
      action: "LIVE_ENDED",
      entity: "live_session",
      entityId: updated.id,
      requestId,
      afterJson: { moderated: true },
    });
    return this.toView(updated);
  }

  private toView(row: {
    id: string;
    memberId: string;
    status: string;
    hlsUrl: string | null;
    previewHlsUrl: string | null;
    ingestUrl: string | null;
    startedAt: Date;
    endedAt: Date | null;
  }): LiveSessionView {
    return {
      id: row.id,
      memberId: row.memberId,
      status: row.status as LiveSessionView["status"],
      hlsUrl: row.hlsUrl,
      previewHlsUrl: row.previewHlsUrl,
      ingestUrl: row.ingestUrl,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
    };
  }
}
