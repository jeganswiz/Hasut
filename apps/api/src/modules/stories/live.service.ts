import { randomUUID } from "node:crypto";
import { normalizeBlockedWords, type LivePolicy } from "@hasut/config";
import type {
  LiveComposerConfig,
  LiveEndReason,
  LiveHostPreview,
  LiveRecordingStatus,
  LiveScheduleInput,
  LiveSessionStatus,
  LiveSessionView,
  LiveSettingsInput,
  LiveStartInput,
  LiveSummaryView,
  LiveReplayInput,
  LiveReplayStatus,
  MemberRole,
  StoryAudience,
} from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { assertModerationAccess } from "../../common/auth/staff-auth";
import type { ApiEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { LiveViewerRegistry } from "../realtime/live-viewer-registry";
import { RealtimeEvents } from "../realtime/realtime.events";
import { ReportsService } from "../reports/reports.service";
import { livePlaybackUrls } from "./playback-origin";
import { LiveNotificationsService } from "./live-notifications.service";
import { PatronsService } from "./patrons.service";
import { StoriesService } from "./stories.service";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface LiveRow {
  id: string;
  memberId: string;
  title: string;
  description: string;
  category: string | null;
  thumbnailMediaId: string | null;
  audience: string;
  status: string;
  scheduledFor: Date | null;
  hlsUrl: string | null;
  previewHlsUrl: string | null;
  ingestUrl: string | null;
  chatEnabled: boolean;
  chatPatronsOnly: boolean;
  slowModeSeconds: number;
  blockedWords: string[];
  recordingEnabled: boolean;
  recordingStatus: string;
  replayStoryId: string | null;
  lastHeartbeatAt: Date | null;
  peakViewers: number;
  totalViews: number;
  reactionCount: number;
  messageCount: number;
  endedReason: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

interface ViewOptions {
  /** Owner and moderators see ingest and the blocked-word list. */
  owner: boolean;
}

/**
 * Lifecycle of a broadcast. The database keeps one LIVE row per member, so a
 * duplicate start surfaces as CONFLICT instead of two sessions. Audience rules
 * (Patrons, invites, blocks) are decided here, never in a client.
 */
@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stories: StoriesService,
    private readonly patrons: PatronsService,
    private readonly configuration: ConfigurationService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<ApiEnv, true>,
    private readonly profiles: ProfilesService,
    private readonly media: MediaService,
    private readonly reports: ReportsService,
    private readonly viewers: LiveViewerRegistry,
    private readonly realtime: RealtimeEvents,
    private readonly notifications: LiveNotificationsService,
  ) {}

  async composerConfig(memberId: string): Promise<LiveComposerConfig> {
    await this.stories.assertEnabled();
    const policy = await this.configuration.getLivePolicy();
    return {
      titleMaxLength: policy.titleMaxLength,
      descriptionMaxLength: policy.descriptionMaxLength,
      categories: policy.categories,
      heartbeatSeconds: policy.heartbeatSeconds,
      chatMaxChars: policy.chatMaxChars,
      maxInvitees: policy.maxInvitees,
      maxModerators: policy.maxModerators,
      maxScheduleDaysAhead: policy.maxScheduleDaysAhead,
      recordingAvailable: this.recordingAvailable(),
      replayRetentionDays: policy.replayRetentionDays,
      patronCount: await this.patrons.countFor(memberId),
      playlistPollSeconds: policy.playlistPollSeconds,
    };
  }

  recordingAvailable(): boolean {
    const flag = this.config.get("LIVE_RECORDING_ENABLED", { infer: true });
    const enabled = flag === true || flag === "true";
    return (
      enabled &&
      this.config.get("LIVE_PLAYBACK_API_URL", { infer: true }).trim().length > 0 &&
      this.config.get("FFMPEG_PATH", { infer: true }).trim().length > 0
    );
  }

  async start(
    memberId: string,
    input: LiveStartInput,
    requestId: string,
  ): Promise<LiveSessionView> {
    await this.stories.assertEnabled();
    const storyPolicy = await this.configuration.getStoryPolicy();
    const policy = await this.configuration.getLivePolicy();
    const recent = await this.prisma.liveSession.count({
      where: {
        memberId,
        status: { not: "SCHEDULED" },
        startedAt: { gt: new Date(Date.now() - HOUR_MS) },
      },
    });
    if (recent >= storyPolicy.maxLiveStartsPerHour) {
      throw new HasutHttpException(
        "RATE_LIMITED",
        "Too many live sessions in the last hour. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const scheduled =
      input.scheduledId === undefined
        ? null
        : await this.requireScheduled(memberId, input.scheduledId);
    const audience =
      input.audience ?? (scheduled?.audience as StoryAudience | undefined) ?? "EVERYONE";
    const settings = await this.resolveSettings(memberId, input, policy, scheduled);
    const invitees = await this.resolveInvitees(memberId, audience, input.inviteeIds, policy);
    const recordingEnabled = this.resolveRecording(
      input.recordingEnabled ?? scheduled?.recordingEnabled,
    );

    await this.prisma.liveSession.updateMany({
      where: { memberId, status: "LIVE" },
      data: { status: "ENDED", endedAt: new Date(), endedReason: "HOST" },
    });
    const id = scheduled?.id ?? randomUUID();
    const urls = livePlaybackUrls(
      id,
      this.config.get("LIVE_HLS_BASE_URL", { infer: true }),
      this.config.get("LIVE_WHIP_BASE_URL", { infer: true }),
    );
    const now = new Date();
    const data = {
      ...settings,
      audience,
      status: "LIVE" as const,
      hlsUrl: urls.hlsUrl,
      previewHlsUrl: urls.previewHlsUrl,
      ingestUrl: urls.ingestUrl,
      recordingEnabled,
      recordingStatus: (recordingEnabled ? "RECORDING" : "NONE") as LiveRecordingStatus,
      lastHeartbeatAt: now,
      startedAt: now,
    };
    let created: LiveRow;
    try {
      created =
        scheduled === null
          ? await this.prisma.liveSession.create({ data: { id, memberId, ...data } })
          : await this.prisma.liveSession.update({ where: { id: scheduled.id }, data });
      if (invitees.length > 0) {
        await this.prisma.liveInvite.createMany({
          data: invitees.map((inviteeId) => ({ liveId: id, memberId: inviteeId })),
          skipDuplicates: true,
        });
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HasutHttpException(
          "CONFLICT",
          "You are already live. End that session first.",
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
    await this.audit.record({
      actorId: memberId,
      action: "LIVE_STARTED",
      entity: "live_session",
      entityId: created.id,
      requestId,
      afterJson: {
        hasTitle: created.title.length > 0,
        audience: created.audience,
        recording: created.recordingEnabled,
        scheduled: scheduled !== null,
      },
    });
    await this.notifications.notifyStarted(created);
    return this.toView(created, { owner: true });
  }

  async schedule(
    memberId: string,
    input: LiveScheduleInput,
    requestId: string,
  ): Promise<LiveSessionView> {
    await this.stories.assertEnabled();
    const policy = await this.configuration.getLivePolicy();
    const when = new Date(input.scheduledFor);
    const latest = Date.now() + policy.maxScheduleDaysAhead * DAY_MS;
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now() || when.getTime() > latest) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        `Pick a time between now and ${policy.maxScheduleDaysAhead} days ahead`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const audience = input.audience ?? "EVERYONE";
    const settings = await this.resolveSettings(memberId, input, policy, null);
    const invitees = await this.resolveInvitees(memberId, audience, input.inviteeIds, policy);
    const id = randomUUID();
    const created = await this.prisma.liveSession.create({
      data: {
        id,
        memberId,
        ...settings,
        audience,
        status: "SCHEDULED",
        scheduledFor: when,
        recordingEnabled: this.resolveRecording(input.recordingEnabled),
        startedAt: when,
      },
    });
    if (invitees.length > 0) {
      await this.prisma.liveInvite.createMany({
        data: invitees.map((inviteeId) => ({ liveId: id, memberId: inviteeId })),
        skipDuplicates: true,
      });
    }
    await this.audit.record({
      actorId: memberId,
      action: "LIVE_SCHEDULED",
      entity: "live_session",
      entityId: created.id,
      requestId,
      afterJson: { scheduledFor: when.toISOString(), audience },
    });
    return this.toView(created, { owner: true });
  }

  async listScheduled(memberId: string): Promise<LiveSessionView[]> {
    await this.stories.assertEnabled();
    const rows = await this.prisma.liveSession.findMany({
      where: { memberId, status: "SCHEDULED" },
      orderBy: { scheduledFor: "asc" },
    });
    return Promise.all(rows.map((row) => this.toView(row, { owner: true })));
  }

  async cancelScheduled(
    memberId: string,
    liveId: string,
    requestId: string,
  ): Promise<LiveSessionView> {
    const row = await this.requireScheduled(memberId, liveId);
    const updated = await this.prisma.liveSession.update({
      where: { id: row.id },
      data: { status: "ENDED", endedAt: new Date(), endedReason: "HOST" },
    });
    await this.audit.record({
      actorId: memberId,
      action: "LIVE_SCHEDULE_CANCELLED",
      entity: "live_session",
      entityId: liveId,
      requestId,
    });
    return this.toView(updated, { owner: true });
  }

  /** Settings a host changes mid-broadcast. Audience and recording are fixed at start. */
  async update(
    memberId: string,
    input: LiveSettingsInput,
    requestId: string,
  ): Promise<LiveSessionView> {
    await this.stories.assertEnabled();
    const current = await this.findLive(memberId);
    if (current === null) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    const policy = await this.configuration.getLivePolicy();
    const settings = await this.resolveSettings(memberId, input, policy, current);
    const updated = await this.prisma.liveSession.update({
      where: { id: current.id },
      data: settings,
    });
    await this.audit.record({
      actorId: memberId,
      action: "LIVE_UPDATED",
      entity: "live_session",
      entityId: current.id,
      requestId,
      afterJson: { fields: Object.keys(input) },
    });
    return this.toView(updated, { owner: true });
  }

  /** The host browser confirms it is still broadcasting. The idle worker ends silent sessions. */
  async heartbeat(memberId: string): Promise<LiveSessionView> {
    await this.stories.assertEnabled();
    const current = await this.findLive(memberId);
    if (current === null) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.liveSession.update({
      where: { id: current.id },
      data: { lastHeartbeatAt: new Date() },
    });
    return this.toView(updated, { owner: true });
  }

  /** Owner restore after a refresh. Includes the ingest URL so they can keep sending. */
  async current(memberId: string): Promise<LiveSessionView | null> {
    await this.stories.assertEnabled();
    const row = await this.findLive(memberId);
    return row === null ? null : this.toView(row, { owner: true });
  }

  /**
   * Nearby watch path. A Patrons-only live is invisible to a stranger — same
   * rule as pin media — and the ingest URL never leaves the owner.
   */
  async forViewer(ownerId: string, viewerId: string): Promise<LiveSessionView | null> {
    await this.stories.assertEnabled();
    const row = await this.findLive(ownerId);
    if (row === null || !(await this.canWatch(row, viewerId))) {
      return null;
    }
    return this.toView(row, { owner: viewerId === ownerId });
  }

  /** Watch path by id. Ended sessions stay readable so the viewer can show "ended" or the replay. */
  async byId(liveId: string, viewerId: string): Promise<LiveSessionView> {
    await this.stories.assertEnabled();
    const row = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (row === null || !(await this.canWatch(row, viewerId))) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    const moderator = row.memberId !== viewerId && (await this.isModerator(row.memberId, viewerId));
    return this.toView(row, { owner: viewerId === row.memberId || moderator });
  }

  /**
   * Single place that decides whether `viewerId` may open `row`. The owner
   * always may. A block in either direction closes the door before audience.
   */
  async canWatch(
    row: Pick<LiveRow, "id" | "memberId" | "audience">,
    viewerId: string,
  ): Promise<boolean> {
    if (row.memberId === viewerId) {
      return true;
    }
    if (await this.reports.isBlockedEitherWay(row.memberId, viewerId)) {
      return false;
    }
    if (row.audience === "EVERYONE") {
      return true;
    }
    if (row.audience === "PATRONS") {
      return this.patrons.isPatronOf(row.memberId, viewerId);
    }
    const invite = await this.prisma.liveInvite.findUnique({
      where: { liveId_memberId: { liveId: row.id, memberId: viewerId } },
      select: { liveId: true },
    });
    return invite !== null;
  }

  async isModerator(hostId: string, memberId: string): Promise<boolean> {
    if (hostId === memberId) {
      return true;
    }
    const row = await this.prisma.liveModerator.findUnique({
      where: { hostId_memberId: { hostId, memberId } },
      select: { hostId: true },
    });
    return row !== null;
  }

  async end(memberId: string, requestId: string): Promise<LiveSessionView> {
    await this.stories.assertEnabled();
    const current = await this.findLive(memberId);
    if (current === null) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    return this.finish(current, "HOST", memberId, requestId, {});
  }

  /** Called by the lifecycle worker when the host stopped sending heartbeats. */
  async endIdle(liveId: string): Promise<LiveSessionView | null> {
    const row = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (row === null || row.status !== "LIVE") {
      return null;
    }
    return this.finish(row, "IDLE_TIMEOUT", null, `live-idle-${liveId}`, { idle: true });
  }

  async listAdmin(roles: readonly MemberRole[]): Promise<LiveSessionView[]> {
    assertModerationAccess(roles);
    const rows = await this.prisma.liveSession.findMany({
      where: { status: "LIVE" },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
    return Promise.all(rows.map((row) => this.toView(row, { owner: true })));
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
    if (current.status !== "LIVE") {
      return this.toView(current, { owner: true });
    }
    return this.finish(current, "MODERATOR", actorId, requestId, { moderated: true });
  }

  async summary(memberId: string, liveId: string): Promise<LiveSummaryView> {
    await this.stories.assertEnabled();
    const row = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (row === null || row.memberId !== memberId) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    const endedAt = row.endedAt ?? new Date();
    return {
      live: await this.toView(row, { owner: true }),
      durationSeconds: Math.max(
        0,
        Math.round((endedAt.getTime() - row.startedAt.getTime()) / 1000),
      ),
      peakViewers: row.peakViewers,
      totalViews: row.totalViews,
      reactionCount: row.reactionCount,
      messageCount: row.messageCount,
      endedReason: row.endedReason as LiveEndReason | null,
    };
  }

  async listModerators(hostId: string): Promise<LiveHostPreview[]> {
    const rows = await this.prisma.liveModerator.findMany({
      where: { hostId },
      orderBy: { createdAt: "asc" },
    });
    return Promise.all(rows.map((row) => this.profiles.getPreview(row.memberId)));
  }

  /** Replaces the host's moderator list. Only Patrons can be moderators. */
  async setModerators(
    hostId: string,
    memberIds: readonly string[],
    requestId: string,
  ): Promise<LiveHostPreview[]> {
    await this.stories.assertEnabled();
    const policy = await this.configuration.getLivePolicy();
    const unique = [...new Set(memberIds)].filter((id) => id !== hostId);
    if (unique.length > policy.maxModerators) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        `You can name up to ${policy.maxModerators} moderators`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const patrons = await this.patrons.patronOwnersAmong(unique, hostId);
    const rejected = unique.filter((id) => !patrons.has(id));
    if (rejected.length > 0) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Moderators must be your Patrons",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.$transaction([
      this.prisma.liveModerator.deleteMany({ where: { hostId } }),
      ...(unique.length > 0
        ? [
            this.prisma.liveModerator.createMany({
              data: unique.map((memberId) => ({ hostId, memberId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    await this.audit.record({
      actorId: hostId,
      action: "LIVE_MODERATORS_SET",
      entity: "member",
      entityId: hostId,
      requestId,
      afterJson: { count: unique.length },
    });
    return this.listModerators(hostId);
  }

  /** Engagement counters the gateway persists. Peak only ever grows. */
  async recordViewerJoin(liveId: string, viewerCount: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "live_sessions"
      SET "total_views" = "total_views" + 1,
          "peak_viewers" = GREATEST("peak_viewers", ${viewerCount})
      WHERE "id" = ${liveId}::uuid AND "status" = 'LIVE'
    `;
  }

  async addReactions(liveId: string, count: number): Promise<void> {
    if (count <= 0) {
      return;
    }
    await this.prisma.liveSession.updateMany({
      where: { id: liveId, status: "LIVE" },
      data: { reactionCount: { increment: count } },
    });
  }

  async addMessage(liveId: string): Promise<void> {
    await this.prisma.liveSession.updateMany({
      where: { id: liveId, status: "LIVE" },
      data: { messageCount: { increment: 1 } },
    });
  }

  async findLive(memberId: string): Promise<LiveRow | null> {
    return this.prisma.liveSession.findFirst({
      where: { memberId, status: "LIVE" },
      orderBy: { startedAt: "desc" },
    });
  }

  async toView(row: LiveRow, options: ViewOptions): Promise<LiveSessionView> {
    const host = await this.profiles.getPreview(row.memberId);
    const replay =
      row.status === "ENDED" && row.recordingStatus === "READY" && row.replayStoryId !== null
        ? await this.prisma.story.findUnique({ where: { id: row.replayStoryId } })
        : null;
    return {
      id: row.id,
      memberId: row.memberId,
      host,
      title: row.title,
      description: row.description,
      category: row.category,
      thumbnailUrl: await this.media.photoUrl(row.thumbnailMediaId),
      audience: row.audience as StoryAudience,
      status: row.status as LiveSessionStatus,
      scheduledFor: row.scheduledFor?.toISOString() ?? null,
      hlsUrl: row.status === "SCHEDULED" ? null : (replay?.hlsUrl ?? row.hlsUrl),
      previewHlsUrl:
        row.status === "SCHEDULED"
          ? null
          : (replay?.previewHlsUrl ?? replay?.hlsUrl ?? row.previewHlsUrl),
      ingestUrl: options.owner ? row.ingestUrl : null,
      chatEnabled: row.chatEnabled,
      chatPatronsOnly: row.chatPatronsOnly,
      slowModeSeconds: row.slowModeSeconds,
      blockedWords: options.owner ? row.blockedWords : [],
      recordingEnabled: row.recordingEnabled,
      recordingStatus: row.recordingStatus as LiveRecordingStatus,
      replayStoryId: row.replayStoryId,
      viewerCount: row.status === "LIVE" ? this.viewers.count(row.id) : 0,
      peakViewers: row.peakViewers,
      totalViews: row.totalViews,
      reactionCount: row.reactionCount,
      messageCount: row.messageCount,
      endedReason: row.endedReason as LiveEndReason | null,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
    };
  }

  private async finish(
    row: LiveRow,
    reason: LiveEndReason,
    actorId: string | null,
    requestId: string,
    detail: Record<string, boolean>,
  ): Promise<LiveSessionView> {
    const updated = await this.prisma.liveSession.update({
      where: { id: row.id },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        endedReason: reason,
        recordingStatus: (row.recordingEnabled && row.recordingStatus === "RECORDING"
          ? "PROCESSING"
          : row.recordingStatus) as LiveRecordingStatus,
        peakViewers: Math.max(row.peakViewers, this.viewers.count(row.id)),
      },
    });
    this.viewers.clear(row.id);
    this.realtime.publishRoom(`live:${row.id}`, "live.ended", {
      liveId: row.id,
      endedReason: reason,
    });
    await this.audit.record({
      actorId,
      action: "LIVE_ENDED",
      entity: "live_session",
      entityId: updated.id,
      requestId,
      afterJson: { reason, ...detail },
    });
    return this.toView(updated, { owner: true });
  }

  private resolveRecording(requested: boolean | undefined): boolean {
    return requested === true && this.recordingAvailable();
  }

  private async requireScheduled(memberId: string, liveId: string): Promise<LiveRow> {
    const row = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (row === null || row.memberId !== memberId || row.status !== "SCHEDULED") {
      throw new HasutHttpException("NOT_FOUND", "No scheduled live", HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async resolveSettings(
    memberId: string,
    input: LiveSettingsInput,
    policy: LivePolicy,
    base: LiveRow | null,
  ): Promise<{
    title: string;
    description: string;
    category: string | null;
    thumbnailMediaId: string | null;
    chatEnabled: boolean;
    chatPatronsOnly: boolean;
    slowModeSeconds: number;
    blockedWords: string[];
  }> {
    const title = (input.title ?? base?.title ?? "").trim();
    if (title.length > policy.titleMaxLength) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        `Keep the title under ${policy.titleMaxLength} characters`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const description = (input.description ?? base?.description ?? "").trim();
    if (description.length > policy.descriptionMaxLength) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        `Keep the description under ${policy.descriptionMaxLength} characters`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const category = input.category === undefined ? (base?.category ?? null) : input.category;
    if (category !== null && !policy.categories.includes(category)) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Pick a category from the list",
        HttpStatus.BAD_REQUEST,
      );
    }
    const thumbnailMediaId =
      input.thumbnailMediaId === undefined
        ? (base?.thumbnailMediaId ?? null)
        : input.thumbnailMediaId;
    if (thumbnailMediaId !== null && thumbnailMediaId !== base?.thumbnailMediaId) {
      await this.requireOwnedImage(memberId, thumbnailMediaId);
    }
    return {
      title,
      description,
      category,
      thumbnailMediaId,
      chatEnabled: input.chatEnabled ?? base?.chatEnabled ?? true,
      chatPatronsOnly: input.chatPatronsOnly ?? base?.chatPatronsOnly ?? false,
      slowModeSeconds: input.slowModeSeconds ?? base?.slowModeSeconds ?? 0,
      blockedWords: normalizeBlockedWords(input.blockedWords ?? base?.blockedWords ?? []),
    };
  }

  private async requireOwnedImage(memberId: string, mediaId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (asset === null || asset.ownerMemberId !== memberId) {
      throw new HasutHttpException("NOT_FOUND", "Media not found", HttpStatus.NOT_FOUND);
    }
    if (asset.status !== "READY" || asset.purpose !== "STORY_IMAGE") {
      throw new HasutHttpException(
        "MEDIA_REJECTED",
        "The thumbnail is not a ready story image",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PRIVATE lives carry an invite list of Patrons. Other audiences ignore the
   * list, so a stray id cannot widen a Patrons-only live.
   */
  private async resolveInvitees(
    memberId: string,
    audience: StoryAudience,
    inviteeIds: readonly string[] | undefined,
    policy: LivePolicy,
  ): Promise<string[]> {
    if (audience !== "PRIVATE") {
      return [];
    }
    if (inviteeIds === undefined) {
      // Starting a scheduled private live keeps the invites saved with it; nothing to add.
      return [];
    }
    const unique = [...new Set(inviteeIds)].filter((id) => id !== memberId);
    if (unique.length > policy.maxInvitees) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        `You can invite up to ${policy.maxInvitees} Patrons`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const patrons = await this.patrons.patronOwnersAmong(unique, memberId);
    const strangers = unique.filter((id) => !patrons.has(id));
    if (strangers.length > 0) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Only your Patrons can be invited to a private live",
        HttpStatus.BAD_REQUEST,
      );
    }
    return unique;
  }

  async replayStatus(memberId: string, liveId: string): Promise<LiveReplayStatus> {
    const row = await this.requireOwnedEnded(memberId, liveId);
    const story =
      row.replayStoryId === null
        ? null
        : await this.prisma.story.findUnique({ where: { id: row.replayStoryId } });
    return {
      liveId: row.id,
      recordingStatus: row.recordingStatus as LiveRecordingStatus,
      replayStoryId: row.replayStoryId,
      replayHlsUrl: story?.hlsUrl ?? story?.previewHlsUrl ?? null,
    };
  }

  async updateReplay(
    memberId: string,
    liveId: string,
    input: LiveReplayInput,
    requestId: string,
  ): Promise<LiveReplayStatus> {
    const row = await this.requireOwnedEnded(memberId, liveId);
    if (row.recordingStatus !== "READY" && input.visibility !== "DISCARD") {
      throw new HasutHttpException(
        "CONFLICT",
        "The replay is not ready to publish yet",
        HttpStatus.CONFLICT,
      );
    }
    if (input.visibility === "DISCARD") {
      await this.prisma.liveSession.update({
        where: { id: row.id },
        data: { recordingStatus: "DISCARDED" },
      });
      if (row.replayStoryId !== null) {
        await this.prisma.story.update({
          where: { id: row.replayStoryId },
          data: { moderationStatus: "HIDDEN" },
        });
      }
      await this.audit.record({
        actorId: memberId,
        action: "LIVE_REPLAY_DISCARDED",
        entity: "live_session",
        entityId: row.id,
        requestId,
      });
      return this.replayStatus(memberId, liveId);
    }
    if (row.replayStoryId === null) {
      throw new HasutHttpException("NOT_FOUND", "No replay", HttpStatus.NOT_FOUND);
    }
    const audience =
      input.visibility === undefined ? undefined : (input.visibility as StoryAudience);
    await this.prisma.story.update({
      where: { id: row.replayStoryId },
      data: {
        caption: input.title ?? undefined,
        audience,
      },
    });
    if (input.title !== undefined || input.description !== undefined) {
      await this.prisma.liveSession.update({
        where: { id: row.id },
        data: {
          title: input.title ?? row.title,
          description: input.description ?? row.description,
        },
      });
    }
    await this.audit.record({
      actorId: memberId,
      action: "LIVE_REPLAY_PUBLISHED",
      entity: "live_session",
      entityId: row.id,
      requestId,
      afterJson: { visibility: input.visibility ?? null },
    });
    const updated = await this.prisma.liveSession.findUniqueOrThrow({ where: { id: row.id } });
    await this.notifications.notifyReplayPublished(updated, row.replayStoryId);
    return this.replayStatus(memberId, liveId);
  }

  private async requireOwnedEnded(memberId: string, liveId: string): Promise<LiveRow> {
    const row = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (row === null || row.memberId !== memberId || row.status !== "ENDED") {
      throw new HasutHttpException("NOT_FOUND", "No ended live", HttpStatus.NOT_FOUND);
    }
    return row;
  }
}
