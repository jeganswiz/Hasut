import { randomUUID } from "node:crypto";
import type { MemberRole, PinMediaKind, StoryView } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { assertModerationAccess } from "../../common/auth/staff-auth";
import type { ApiEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";

const FLAG = "stories.live";
const TTL_MS = 24 * 60 * 60 * 1000;

export interface PinMedia {
  kind: PinMediaKind;
  previewHlsUrl: string | null;
  imageUrl: string | null;
}

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuration: ConfigurationService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<ApiEnv, true>,
  ) {}

  async assertEnabled(): Promise<void> {
    const flags = await this.configuration.getPublicFlags();
    if (flags.flags[FLAG] !== true) {
      throw new HasutHttpException("FORBIDDEN", "Stories are not enabled", HttpStatus.FORBIDDEN);
    }
  }

  async enabled(): Promise<boolean> {
    const flags = await this.configuration.getPublicFlags();
    return flags.flags[FLAG] === true;
  }

  async create(
    memberId: string,
    input: {
      kind: "IMAGE" | "VIDEO";
      imageMediaId?: string;
      videoMediaId?: string;
      audioMediaId?: string | null;
    },
    requestId: string,
  ): Promise<StoryView> {
    await this.assertEnabled();
    if (input.kind === "IMAGE" && input.imageMediaId === undefined) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "An image is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.kind === "VIDEO" && input.videoMediaId === undefined) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "A video is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    const id = randomUUID();
    const hls = this.hlsUrls(id, input.kind);
    const created = await this.prisma.story.create({
      data: {
        id,
        memberId,
        kind: input.kind,
        imageMediaId: input.imageMediaId ?? null,
        videoMediaId: input.videoMediaId ?? null,
        audioMediaId: input.audioMediaId ?? null,
        hlsUrl: hls.hlsUrl,
        previewHlsUrl: hls.previewHlsUrl,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
    await this.audit.record({
      actorId: memberId,
      action: "STORY_CREATED",
      entity: "story",
      entityId: created.id,
      requestId,
      afterJson: { kind: input.kind },
    });
    return this.toView(created);
  }

  async listMine(memberId: string): Promise<StoryView[]> {
    await this.assertEnabled();
    const rows = await this.prisma.story.findMany({
      where: { memberId, expiresAt: { gt: new Date() }, moderationStatus: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async listAdmin(roles: readonly MemberRole[]): Promise<StoryView[]> {
    assertModerationAccess(roles);
    const rows = await this.prisma.story.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async hide(
    actorId: string,
    roles: readonly MemberRole[],
    storyId: string,
    requestId: string,
  ): Promise<StoryView> {
    assertModerationAccess(roles);
    const updated = await this.prisma.story.update({
      where: { id: storyId },
      data: { moderationStatus: "HIDDEN" },
    });
    await this.audit.record({
      actorId,
      action: "STORY_HIDDEN",
      entity: "story",
      entityId: storyId,
      requestId,
    });
    return this.toView(updated);
  }

  async pinMediaForMembers(memberIds: string[]): Promise<Map<string, PinMedia>> {
    const map = new Map<string, PinMedia>();
    if (memberIds.length === 0 || !(await this.enabled())) {
      return map;
    }
    const now = new Date();
    const lives = await this.prisma.liveSession.findMany({
      where: { memberId: { in: memberIds }, status: "LIVE" },
    });
    for (const live of lives) {
      map.set(live.memberId, { kind: "LIVE", previewHlsUrl: live.previewHlsUrl, imageUrl: null });
    }
    const stories = await this.prisma.story.findMany({
      where: {
        memberId: { in: memberIds },
        expiresAt: { gt: now },
        moderationStatus: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
    });
    for (const story of stories) {
      const current = map.get(story.memberId);
      if (current?.kind === "LIVE" || current?.kind === "VIDEO") {
        continue;
      }
      if (story.kind === "VIDEO") {
        map.set(story.memberId, {
          kind: "VIDEO",
          previewHlsUrl: story.previewHlsUrl,
          imageUrl: null,
        });
      } else if (current === undefined) {
        map.set(story.memberId, {
          kind: "IMAGE",
          previewHlsUrl: null,
          imageUrl: await this.media.photoUrl(story.imageMediaId),
        });
      }
    }
    return map;
  }

  private hlsUrls(
    id: string,
    kind: "IMAGE" | "VIDEO",
  ): { hlsUrl: string | null; previewHlsUrl: string | null } {
    if (kind === "IMAGE") {
      return { hlsUrl: null, previewHlsUrl: null };
    }
    const base = this.config.get("LIVE_HLS_BASE_URL", { infer: true });
    const origin = base.length > 0 ? base.replace(/\/$/, "") : "/media/hls";
    return {
      hlsUrl: `${origin}/${id}/index.m3u8`,
      previewHlsUrl: `${origin}/${id}/preview.m3u8`,
    };
  }

  private async toView(row: {
    id: string;
    memberId: string;
    kind: string;
    imageMediaId: string | null;
    videoMediaId: string | null;
    audioMediaId: string | null;
    hlsUrl: string | null;
    previewHlsUrl: string | null;
    expiresAt: Date;
    moderationStatus: string;
    createdAt: Date;
  }): Promise<StoryView> {
    return {
      id: row.id,
      memberId: row.memberId,
      kind: row.kind as StoryView["kind"],
      imageUrl: await this.media.photoUrl(row.imageMediaId),
      hlsUrl: row.hlsUrl,
      previewHlsUrl: row.previewHlsUrl,
      audioUrl: await this.media.photoUrl(row.audioMediaId),
      expiresAt: row.expiresAt.toISOString(),
      moderationStatus: row.moderationStatus as StoryView["moderationStatus"],
      createdAt: row.createdAt.toISOString(),
    };
  }
}
