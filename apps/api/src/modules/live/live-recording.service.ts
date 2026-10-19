import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../config/env";
import { ConfigurationService } from "../configuration/configuration.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";

const LIVE_STORY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Pulls a MediaMTX recording after the host ends, stores it as a story of
 * kind LIVE, and lets the existing ffmpeg worker publish the playlist.
 */
@Injectable()
export class LiveRecordingService {
  private readonly logger = new Logger(LiveRecordingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApiEnv, true>,
    private readonly configuration: ConfigurationService,
    private readonly media: MediaService,
  ) {}

  async processNext(): Promise<"idle" | "ready" | "failed"> {
    const ready = await this.promoteReady();
    if (ready !== "idle") {
      return ready;
    }
    if (!this.available()) {
      return "idle";
    }
    const row = await this.prisma.liveSession.findFirst({
      where: {
        status: "ENDED",
        recordingEnabled: true,
        recordingStatus: "PROCESSING",
        replayStoryId: null,
      },
      orderBy: { endedAt: "asc" },
    });
    if (row === null) {
      return "idle";
    }
    try {
      await this.finalize(row.id);
      return "ready";
    } catch (error) {
      const name = error instanceof Error ? error.name : "error";
      this.logger.warn(`Live recording failed for ${row.id} (${name})`);
      await this.prisma.liveSession.update({
        where: { id: row.id },
        data: { recordingStatus: "FAILED" },
      });
      return "failed";
    }
  }

  async finalize(liveId: string): Promise<void> {
    const row = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (row === null || !row.recordingEnabled || row.recordingStatus === "DISCARDED") {
      return;
    }
    const origin = this.config
      .get("LIVE_PLAYBACK_API_URL", { infer: true })
      .trim()
      .replace(/\/$/, "");
    if (origin.length === 0) {
      throw new Error("playback-unconfigured");
    }
    const started = Math.floor(row.startedAt.getTime() / 1000);
    const ended = Math.floor((row.endedAt ?? new Date()).getTime() / 1000);
    const duration = Math.max(1, ended - started);
    const response = await fetch(
      `${origin}/get?path=${encodeURIComponent(`live/${row.id}`)}&start=${started}&duration=${duration}`,
    );
    if (!response.ok) {
      throw new Error("playback-missing");
    }
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength === 0) {
      throw new Error("playback-empty");
    }
    const policy = await this.configuration.getLivePolicy();
    const storyId = row.id;
    if (!LIVE_STORY_ID.test(storyId)) {
      throw new Error("story-id");
    }
    const existing = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (existing !== null) {
      await this.prisma.liveSession.update({
        where: { id: row.id },
        data: {
          replayStoryId: existing.id,
          recordingStatus: existing.playbackStatus === "READY" ? "READY" : "PROCESSING",
        },
      });
      return;
    }
    const objectKey = `live-recordings/${storyId}.mp4`;
    await this.media.writeObject(objectKey, Buffer.from(body), "video/mp4");
    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerMemberId: row.memberId,
        purpose: "STORY_VIDEO",
        status: "READY",
        mimeType: "video/mp4",
        byteSize: body.byteLength,
        objectKey,
        bucket: "hasut-media",
      },
    });
    const expiresAt = new Date(Date.now() + policy.replayRetentionDays * 24 * 60 * 60 * 1000);
    await this.prisma.story.create({
      data: {
        id: storyId,
        memberId: row.memberId,
        kind: "LIVE",
        videoMediaId: asset.id,
        audience: row.audience === "PRIVATE" ? "PRIVATE" : row.audience,
        caption: row.title,
        playbackStatus: "PENDING",
        expiresAt,
      },
    });
    await this.prisma.liveSession.update({
      where: { id: row.id },
      data: { replayStoryId: storyId, recordingStatus: "PROCESSING" },
    });
  }

  available(): boolean {
    return this.config.get("LIVE_PLAYBACK_API_URL", { infer: true }).trim().length > 0;
  }

  private async promoteReady(): Promise<"idle" | "ready"> {
    const row = await this.prisma.liveSession.findFirst({
      where: {
        status: "ENDED",
        recordingStatus: "PROCESSING",
        replayStoryId: { not: null },
      },
      orderBy: { endedAt: "asc" },
    });
    if (row === null || row.replayStoryId === null) {
      return "idle";
    }
    const story = await this.prisma.story.findUnique({ where: { id: row.replayStoryId } });
    if (story?.playbackStatus === "READY") {
      await this.prisma.liveSession.update({
        where: { id: row.id },
        data: { recordingStatus: "READY" },
      });
      return "ready";
    }
    return "idle";
  }
}
