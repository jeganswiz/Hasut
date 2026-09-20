import type { AudioTrackView, MemberRole } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { assertModerationAccess } from "../../common/auth/staff-auth";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";

interface AudioTrackRow {
  id: string;
  title: string;
  artist: string;
  mediaId: string;
  durationSeconds: number;
  mood: string;
  isActive: boolean;
}

/**
 * The HASUT-cloud soundtrack catalogue. Tracks are curated by staff so the
 * licensing question is answered once here rather than on every member upload.
 */
@Injectable()
export class AudioLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuration: ConfigurationService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  /** Members only ever see active tracks, and only when the library is on. */
  async listActive(): Promise<AudioTrackView[]> {
    const policy = await this.configuration.getStoryPolicy();
    if (!policy.audioLibraryEnabled) {
      return [];
    }
    const rows = await this.prisma.audioTrack.findMany({
      where: { isActive: true },
      orderBy: [{ mood: "asc" }, { title: "asc" }],
    });
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async listAll(roles: readonly MemberRole[]): Promise<AudioTrackView[]> {
    assertModerationAccess(roles);
    const rows = await this.prisma.audioTrack.findMany({
      orderBy: [{ isActive: "desc" }, { mood: "asc" }, { title: "asc" }],
      take: 200,
    });
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async create(
    actorId: string,
    roles: readonly MemberRole[],
    input: {
      title: string;
      artist: string;
      mediaId: string;
      durationSeconds: number;
      mood: string;
      isActive: boolean;
    },
    requestId: string,
  ): Promise<AudioTrackView> {
    assertModerationAccess(roles);
    const created = await this.prisma.audioTrack.create({ data: input });
    await this.audit.record({
      actorId,
      action: "AUDIO_TRACK_CREATED",
      entity: "audio_track",
      entityId: created.id,
      requestId,
      afterJson: { title: created.title, mood: created.mood },
    });
    return this.toView(created);
  }

  async setActive(
    actorId: string,
    roles: readonly MemberRole[],
    trackId: string,
    isActive: boolean,
    requestId: string,
  ): Promise<AudioTrackView> {
    assertModerationAccess(roles);
    const existing = await this.prisma.audioTrack.findUnique({ where: { id: trackId } });
    if (existing === null) {
      throw new HasutHttpException("NOT_FOUND", "Track not found", HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.audioTrack.update({
      where: { id: trackId },
      data: { isActive },
    });
    await this.audit.record({
      actorId,
      action: isActive ? "AUDIO_TRACK_ENABLED" : "AUDIO_TRACK_DISABLED",
      entity: "audio_track",
      entityId: trackId,
      requestId,
    });
    return this.toView(updated);
  }

  /**
   * Resolves a member's track choice. Rejects unknown or retired tracks so a
   * stale composer cannot pin a story to something staff already pulled.
   */
  async requirePlayable(trackId: string): Promise<AudioTrackRow> {
    const policy = await this.configuration.getStoryPolicy();
    if (!policy.audioLibraryEnabled) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "The audio library is not available",
        HttpStatus.FORBIDDEN,
      );
    }
    const row = await this.prisma.audioTrack.findUnique({ where: { id: trackId } });
    if (row === null || !row.isActive) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "That track is no longer available",
        HttpStatus.BAD_REQUEST,
      );
    }
    return row;
  }

  private async toView(row: AudioTrackRow): Promise<AudioTrackView> {
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      durationSeconds: row.durationSeconds,
      audioUrl: await this.media.photoUrl(row.mediaId),
      mood: row.mood,
      isActive: row.isActive,
    };
  }
}
