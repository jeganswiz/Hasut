import type { LiveMetricInput, LiveMetricsSummary } from "@hasut/types";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LiveService } from "../stories/live.service";

@Injectable()
export class LiveMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveService,
  ) {}

  async record(liveId: string, memberId: string, input: LiveMetricInput): Promise<void> {
    const row = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (row === null || !(await this.live.canWatch(row, memberId))) {
      return;
    }
    await this.prisma.liveMetricSample.create({
      data: {
        liveId,
        memberId,
        startupMs: input.startupMs ?? null,
        fatalErrors: input.fatalErrors ?? 0,
        reconnects: input.reconnects ?? 0,
        droppedFrames: input.droppedFrames ?? 0,
      },
    });
  }

  async summary(liveId: string): Promise<LiveMetricsSummary> {
    const rows = await this.prisma.liveMetricSample.findMany({ where: { liveId } });
    const startups = rows
      .map((row) => row.startupMs)
      .filter((value): value is number => value !== null);
    return {
      samples: rows.length,
      avgStartupMs:
        startups.length === 0
          ? null
          : Math.round(startups.reduce((sum, value) => sum + value, 0) / startups.length),
      fatalErrors: rows.reduce((sum, row) => sum + row.fatalErrors, 0),
      reconnects: rows.reduce((sum, row) => sum + row.reconnects, 0),
      droppedFrames: rows.reduce((sum, row) => sum + row.droppedFrames, 0),
    };
  }
}
