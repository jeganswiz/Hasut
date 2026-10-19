import type { LiveCardStatus, LiveCardView, LiveDiscoverResult, StoryAudience } from "@hasut/types";
import { Injectable } from "@nestjs/common";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { LiveViewerRegistry } from "../realtime/live-viewer-registry";
import { LiveService, type LiveRow } from "../stories/live.service";
import { PatronsService } from "../stories/patrons.service";

@Injectable()
export class LiveDiscoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveService,
    private readonly patrons: PatronsService,
    private readonly profiles: ProfilesService,
    private readonly media: MediaService,
    private readonly viewers: LiveViewerRegistry,
  ) {}

  async discover(viewerId: string): Promise<LiveDiscoverResult> {
    const [lives, scheduled, replays] = await Promise.all([
      this.prisma.liveSession.findMany({
        where: { status: "LIVE" },
        orderBy: { startedAt: "desc" },
        take: 80,
      }),
      this.prisma.liveSession.findMany({
        where: { status: "SCHEDULED", scheduledFor: { gt: new Date() } },
        orderBy: { scheduledFor: "asc" },
        take: 40,
      }),
      this.prisma.liveSession.findMany({
        where: { status: "ENDED", recordingStatus: "READY", replayStoryId: { not: null } },
        orderBy: { endedAt: "desc" },
        take: 20,
      }),
    ]);
    const visibleLives = await this.visible(lives, viewerId);
    const visibleUpcoming = await this.visible(scheduled, viewerId);
    const visibleReplays = await this.visible(replays, viewerId);
    const patronIds = await this.patrons.patronOwnersAmong(
      visibleLives.map((row) => row.memberId),
      viewerId,
    );
    const liveNow = (await Promise.all(visibleLives.map((row) => this.toCard(row, "LIVE")))).filter(
      (card) => card.host.id !== viewerId,
    );
    const patrons = liveNow.filter((card) => patronIds.has(card.host.id));
    const nearbyIds = new Set(liveNow.slice(0, 12).map((card) => card.id));
    return {
      liveNow: liveNow.slice(0, 24),
      patrons,
      upcoming: await Promise.all(visibleUpcoming.map((row) => this.toCard(row, "UPCOMING"))),
      recommended: liveNow
        .filter((card) => !nearbyIds.has(card.id) && card.audience === "EVERYONE")
        .slice(0, 12),
      recentReplays: await Promise.all(visibleReplays.map((row) => this.toCard(row, "REPLAY"))),
    };
  }

  private async visible(rows: LiveRow[], viewerId: string): Promise<LiveRow[]> {
    const kept: LiveRow[] = [];
    for (const row of rows) {
      if (await this.live.canWatch(row, viewerId)) {
        kept.push(row);
      }
    }
    return kept;
  }

  private async toCard(row: LiveRow, status: LiveCardStatus): Promise<LiveCardView> {
    return {
      id: row.id,
      host: await this.profiles.getPreview(row.memberId),
      title: row.title,
      category: row.category,
      thumbnailUrl: await this.media.photoUrl(row.thumbnailMediaId),
      previewHlsUrl: status === "UPCOMING" ? null : row.previewHlsUrl,
      audience: row.audience as StoryAudience,
      status,
      viewerCount: status === "LIVE" ? this.viewers.count(row.id) : row.peakViewers,
      scheduledFor: row.scheduledFor?.toISOString() ?? null,
      distanceBucket: null,
      href: `/live/${row.id}`,
    };
  }
}
