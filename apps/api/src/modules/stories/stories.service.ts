import { randomUUID } from "node:crypto";
import type { StoryPolicy } from "@hasut/config";
import type {
  MemberRole,
  PinMediaKind,
  StoryAudience,
  StoryAudioSource,
  StoryAudioView,
  StoryComposerConfig,
  StoryOriginalAudioMode,
  StoryView,
} from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { assertModerationAccess } from "../../common/auth/staff-auth";
import type { ApiEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { AudioLibraryService } from "./audio-library.service";
import { PatronsService } from "./patrons.service";

const FLAG = "stories.live";
const TTL_MS = 24 * 60 * 60 * 1000;

export interface PinMedia {
  kind: PinMediaKind;
  previewHlsUrl: string | null;
  imageUrl: string | null;
}

export interface StoryCreateInput {
  kind: "IMAGE" | "VIDEO";
  imageMediaId?: string;
  videoMediaId?: string;
  caption?: string;
  captionColor?: string | null;
  audio?: {
    source: StoryAudioSource;
    trackId?: string | null;
    mediaId?: string | null;
    startSeconds?: number;
    endSeconds?: number | null;
  };
  originalAudioMode?: StoryOriginalAudioMode;
  audience?: StoryAudience;
  trimStartSeconds?: number;
  trimEndSeconds?: number | null;
}

interface StoryRow {
  id: string;
  memberId: string;
  kind: string;
  imageMediaId: string | null;
  videoMediaId: string | null;
  audioMediaId: string | null;
  audioSource: string;
  audioTrackId: string | null;
  audioStartSeconds: number;
  audioEndSeconds: number | null;
  originalAudioMode: string;
  audience: string;
  caption: string;
  captionColor: string | null;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  hlsUrl: string | null;
  previewHlsUrl: string | null;
  expiresAt: Date;
  moderationStatus: string;
  createdAt: Date;
}

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuration: ConfigurationService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly audioLibrary: AudioLibraryService,
    private readonly patrons: PatronsService,
    private readonly config: ConfigService<ApiEnv, true>,
  ) {}

  /** Composer rules the clients render against, so no app hardcodes a palette. */
  async composerConfig(memberId: string): Promise<StoryComposerConfig> {
    const policy = await this.configuration.getStoryPolicy();
    return {
      captionMaxLength: policy.captionMaxLength,
      captionColors: policy.captionColors,
      maxVideoDurationSeconds: policy.maxVideoDurationSeconds,
      maxAudioSegmentSeconds: policy.maxAudioSegmentSeconds,
      audioLibraryEnabled: policy.audioLibraryEnabled,
      patronCount: await this.patrons.countFor(memberId),
    };
  }

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

  async create(memberId: string, input: StoryCreateInput, requestId: string): Promise<StoryView> {
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

    const policy = await this.configuration.getStoryPolicy();
    const caption = this.resolveCaption(input.caption ?? "", policy);
    const captionColor = this.resolveCaptionColor(input.captionColor ?? null, policy);
    const trim = this.resolveTrim(input, policy);
    const audio = await this.resolveAudio(input, policy);

    const id = randomUUID();
    const hls = this.hlsUrls(id, input.kind);
    const created = await this.prisma.story.create({
      data: {
        id,
        memberId,
        kind: input.kind,
        imageMediaId: input.imageMediaId ?? null,
        videoMediaId: input.videoMediaId ?? null,
        audioMediaId: audio.mediaId,
        audioSource: audio.source,
        audioTrackId: audio.trackId,
        audioStartSeconds: audio.startSeconds,
        audioEndSeconds: audio.endSeconds,
        originalAudioMode: input.originalAudioMode ?? "KEEP",
        audience: input.audience ?? "EVERYONE",
        caption,
        captionColor,
        trimStartSeconds: trim.startSeconds,
        trimEndSeconds: trim.endSeconds,
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
      // Caption text is member content; the audit trail records shape, not words.
      afterJson: {
        kind: input.kind,
        audience: created.audience,
        audioSource: audio.source,
        originalAudioMode: created.originalAudioMode,
        hasCaption: caption.length > 0,
        trimmed: trim.endSeconds !== null || trim.startSeconds > 0,
      },
    });
    return this.toView(created);
  }

  private resolveCaption(caption: string, policy: StoryPolicy): string {
    const trimmed = caption.trim();
    if (trimmed.length > policy.captionMaxLength) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        `Keep the caption under ${policy.captionMaxLength} characters`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return trimmed;
  }

  /** Only palette colours survive, so a caption can never be made unreadable. */
  private resolveCaptionColor(color: string | null, policy: StoryPolicy): string | null {
    if (color === null) {
      return null;
    }
    const match = policy.captionColors.find(
      (allowed) => allowed.toLowerCase() === color.toLowerCase(),
    );
    if (match === undefined) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Pick a caption colour from the palette",
        HttpStatus.BAD_REQUEST,
      );
    }
    return match;
  }

  private resolveTrim(
    input: StoryCreateInput,
    policy: StoryPolicy,
  ): { startSeconds: number; endSeconds: number | null } {
    const startSeconds = Math.round(input.trimStartSeconds ?? 0);
    const rawEnd = input.trimEndSeconds ?? null;
    if (rawEnd === null) {
      return { startSeconds, endSeconds: null };
    }
    const endSeconds = Math.round(rawEnd);
    if (endSeconds <= startSeconds) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "The clip must end after it starts",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (endSeconds - startSeconds > policy.maxVideoDurationSeconds) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        `Keep the clip under ${policy.maxVideoDurationSeconds} seconds`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return { startSeconds, endSeconds };
  }

  private async resolveAudio(
    input: StoryCreateInput,
    policy: StoryPolicy,
  ): Promise<{
    source: StoryAudioSource;
    trackId: string | null;
    mediaId: string | null;
    startSeconds: number;
    endSeconds: number | null;
  }> {
    const audio = input.audio;
    if (audio === undefined || audio.source === "NONE") {
      return { source: "NONE", trackId: null, mediaId: null, startSeconds: 0, endSeconds: null };
    }

    const startSeconds = Math.round(audio.startSeconds ?? 0);
    const endSeconds =
      audio.endSeconds === undefined || audio.endSeconds === null
        ? null
        : Math.round(audio.endSeconds);
    if (endSeconds !== null) {
      if (endSeconds <= startSeconds) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "The audio must end after it starts",
          HttpStatus.BAD_REQUEST,
        );
      }
      if (endSeconds - startSeconds > policy.maxAudioSegmentSeconds) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          `Keep the audio under ${policy.maxAudioSegmentSeconds} seconds`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (audio.source === "LIBRARY") {
      const trackId = audio.trackId ?? null;
      if (trackId === null) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "Choose a track from the HASUT library",
          HttpStatus.BAD_REQUEST,
        );
      }
      const track = await this.audioLibrary.requirePlayable(trackId);
      if (startSeconds >= track.durationSeconds) {
        throw new HasutHttpException(
          "VALIDATION_ERROR",
          "That start point is past the end of the track",
          HttpStatus.BAD_REQUEST,
        );
      }
      return {
        source: "LIBRARY",
        trackId: track.id,
        mediaId: null,
        startSeconds,
        // Clamp so a stale client cannot ask for audio the track does not have.
        endSeconds: endSeconds === null ? null : Math.min(endSeconds, track.durationSeconds),
      };
    }

    const mediaId = audio.mediaId ?? null;
    if (mediaId === null) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Upload an audio file",
        HttpStatus.BAD_REQUEST,
      );
    }
    return { source: "UPLOAD", trackId: null, mediaId, startSeconds, endSeconds };
  }

  /** The member's own stories, whatever audience they chose. */
  async listMine(memberId: string): Promise<StoryView[]> {
    await this.assertEnabled();
    const rows = await this.prisma.story.findMany({
      where: { memberId, expiresAt: { gt: new Date() }, moderationStatus: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  /**
   * Someone else's stories, filtered to what the viewer is allowed to see.
   * Before audiences existed this endpoint returned every story for any
   * authenticated caller, so the audience filter is the authorization gate.
   */
  async listForViewer(ownerId: string, viewerId: string): Promise<StoryView[]> {
    await this.assertEnabled();
    const audiences: StoryAudience[] = (await this.patrons.isPatronOf(ownerId, viewerId))
      ? ["EVERYONE", "PATRONS"]
      : ["EVERYONE"];
    const rows = await this.prisma.story.findMany({
      where: {
        memberId: ownerId,
        expiresAt: { gt: new Date() },
        moderationStatus: "ACTIVE",
        audience: { in: audiences },
      },
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

  /**
   * Map-pin previews for a screen of members. `viewerId` decides whether a
   * Patrons-only story or live shows up at all, so a restricted post never
   * leaks as a pin preview to someone who could not open it.
   */
  async pinMediaForMembers(
    memberIds: string[],
    viewerId: string | null,
  ): Promise<Map<string, PinMedia>> {
    const map = new Map<string, PinMedia>();
    if (memberIds.length === 0 || !(await this.enabled())) {
      return map;
    }
    const now = new Date();
    // A signed-out viewer is nobody's Patron, so they only ever see EVERYONE.
    const patrons =
      viewerId === null
        ? new Set<string>()
        : await this.patrons.patronOwnersAmong(memberIds, viewerId);
    const visibleTo = (ownerId: string, audience: string): boolean =>
      audience === "EVERYONE" || patrons.has(ownerId);

    const lives = await this.prisma.liveSession.findMany({
      where: { memberId: { in: memberIds }, status: "LIVE" },
    });
    for (const live of lives) {
      if (!visibleTo(live.memberId, live.audience)) {
        continue;
      }
      map.set(live.memberId, { kind: "LIVE", previewHlsUrl: live.previewHlsUrl, imageUrl: null });
    }
    const stories = await this.prisma.story.findMany({
      where: {
        memberId: { in: memberIds },
        expiresAt: { gt: now },
        moderationStatus: "ACTIVE",
        audience: { in: ["EVERYONE", "PATRONS"] },
      },
      orderBy: { createdAt: "desc" },
    });
    for (const story of stories) {
      if (!visibleTo(story.memberId, story.audience)) {
        continue;
      }
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

  private async toView(row: StoryRow): Promise<StoryView> {
    const audio = await this.audioView(row);
    return {
      id: row.id,
      memberId: row.memberId,
      kind: row.kind as StoryView["kind"],
      imageUrl: await this.media.photoUrl(row.imageMediaId),
      hlsUrl: row.hlsUrl,
      previewHlsUrl: row.previewHlsUrl,
      audioUrl: audio.url,
      audio,
      caption: row.caption,
      captionColor: row.captionColor,
      trimStartSeconds: row.trimStartSeconds,
      trimEndSeconds: row.trimEndSeconds,
      originalAudioMode: row.originalAudioMode as StoryView["originalAudioMode"],
      audience: row.audience as StoryAudience,
      expiresAt: row.expiresAt.toISOString(),
      moderationStatus: row.moderationStatus as StoryView["moderationStatus"],
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async audioView(row: StoryRow): Promise<StoryAudioView> {
    const source = row.audioSource as StoryAudioSource;
    const segment = { startSeconds: row.audioStartSeconds, endSeconds: row.audioEndSeconds };
    if (source === "LIBRARY" && row.audioTrackId !== null) {
      const track = await this.prisma.audioTrack.findUnique({ where: { id: row.audioTrackId } });
      return {
        source,
        trackId: row.audioTrackId,
        title: track === null ? null : `${track.title} — ${track.artist}`,
        url: track === null ? null : await this.media.photoUrl(track.mediaId),
        ...segment,
      };
    }
    if (source === "UPLOAD") {
      return {
        source,
        trackId: null,
        title: null,
        url: await this.media.photoUrl(row.audioMediaId),
        ...segment,
      };
    }
    return {
      source: "NONE",
      trackId: null,
      title: null,
      url: null,
      startSeconds: 0,
      endSeconds: null,
    };
  }
}
