import type {
  LiveDiscoverResult,
  LiveComposerConfig,
  LiveHealthView,
  LiveHeartbeatResult,
  LiveHostPreview,
  LiveMetricsSummary,
  LiveModeratorList,
  LiveReminderState,
  LiveReplayStatus,
  LiveSessionView,
  LiveSummaryView,
} from "@hasut/types";
import type { LiveChatPage } from "@hasut/types";
import {
  liveChatHideSchema,
  liveChatPinSchema,
  liveChatSendSchema,
  liveMetricSchema,
  liveModeratorsSchema,
  liveReplaySchema,
  liveReportSchema,
  liveScheduleSchema,
  liveSettingsSchema,
  liveTimeoutSchema,
} from "@hasut/validation";
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ConfigurationService } from "../configuration/configuration.service";
import { LiveService } from "../stories/live.service";
import { LiveNotificationsService } from "../stories/live-notifications.service";
import { LiveChatService } from "./live-chat.service";
import { LiveDiscoverService } from "./live-discover.service";
import { LiveHealthService } from "./live-health.service";
import { LiveMetricsService } from "./live-metrics.service";

@ApiTags("live")
@Controller()
export class LiveController {
  constructor(
    private readonly live: LiveService,
    private readonly health: LiveHealthService,
    private readonly configuration: ConfigurationService,
    private readonly chat: LiveChatService,
    private readonly discover: LiveDiscoverService,
    private readonly metrics: LiveMetricsService,
    private readonly reminders: LiveNotificationsService,
  ) {}

  @ApiBearerAuth()
  @Get("live/discover")
  @ApiOperation({ summary: "Live now, Patrons, upcoming, recommended, and recent replays" })
  discoverLive(@CurrentUser("memberId") viewerId: string): Promise<LiveDiscoverResult> {
    return this.discover.discover(viewerId);
  }

  @ApiBearerAuth()
  @Get("live/composer")
  @ApiOperation({ summary: "Host studio rules from live.policy" })
  composer(@CurrentUser("memberId") memberId: string): Promise<LiveComposerConfig> {
    return this.live.composerConfig(memberId);
  }

  @ApiBearerAuth()
  @Get("live/:id")
  @ApiOperation({ summary: "Watch a live by id. Audience, invites, and blocks are enforced here." })
  byId(
    @CurrentUser("memberId") viewerId: string,
    @Param("id") liveId: string,
  ): Promise<LiveSessionView> {
    return this.live.byId(liveId, viewerId);
  }

  @ApiBearerAuth()
  @Patch("me/live")
  @ApiOperation({ summary: "Change title, chat, or other settings on the current live" })
  update(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(liveSettingsSchema)) body: z.infer<typeof liveSettingsSchema>,
    @Req() req: Request,
  ): Promise<LiveSessionView> {
    return this.live.update(memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Post("me/live/heartbeat")
  @ApiOperation({ summary: "Confirm the host is still broadcasting" })
  async heartbeat(@CurrentUser("memberId") memberId: string): Promise<LiveHeartbeatResult> {
    const live = await this.live.heartbeat(memberId);
    const policy = await this.configuration.getLivePolicy();
    const current = await this.live.findLive(memberId);
    return {
      live,
      health: await this.health.probe({
        liveId: live.id,
        lastHeartbeatAt: current?.lastHeartbeatAt ?? new Date(),
        idleTimeoutSeconds: policy.idleTimeoutSeconds,
      }),
    };
  }

  @ApiBearerAuth()
  @Get("me/live/health")
  @ApiOperation({ summary: "Media server health for the current live" })
  async myHealth(@CurrentUser("memberId") memberId: string): Promise<LiveHealthView> {
    const current = await this.live.findLive(memberId);
    const policy = await this.configuration.getLivePolicy();
    if (current === null) {
      return {
        state: "OFFLINE",
        streamReady: false,
        tracks: [],
        bitrateKbps: null,
        viewerCount: 0,
        lastHeartbeatAt: null,
        checkedAt: new Date().toISOString(),
      };
    }
    return this.health.probe({
      liveId: current.id,
      lastHeartbeatAt: current.lastHeartbeatAt,
      idleTimeoutSeconds: policy.idleTimeoutSeconds,
    });
  }

  @ApiBearerAuth()
  @Post("me/live/schedule")
  @ApiOperation({ summary: "Schedule a live for later" })
  schedule(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(liveScheduleSchema)) body: z.infer<typeof liveScheduleSchema>,
    @Req() req: Request,
  ): Promise<LiveSessionView> {
    return this.live.schedule(memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Get("me/live/scheduled")
  @ApiOperation({ summary: "Upcoming scheduled lives for the signed-in host" })
  listScheduled(@CurrentUser("memberId") memberId: string): Promise<LiveSessionView[]> {
    return this.live.listScheduled(memberId);
  }

  @ApiBearerAuth()
  @Post("me/live/scheduled/:id/cancel")
  @ApiOperation({ summary: "Cancel a scheduled live" })
  cancelScheduled(
    @CurrentUser("memberId") memberId: string,
    @Param("id") liveId: string,
    @Req() req: Request,
  ): Promise<LiveSessionView> {
    return this.live.cancelScheduled(memberId, liveId, getRequestId(req));
  }

  @ApiBearerAuth()
  @Get("me/live/:id/summary")
  @ApiOperation({ summary: "Post-live summary for the host" })
  summary(
    @CurrentUser("memberId") memberId: string,
    @Param("id") liveId: string,
  ): Promise<LiveSummaryView> {
    return this.live.summary(memberId, liveId);
  }

  @ApiBearerAuth()
  @Get("me/live/moderators")
  @ApiOperation({ summary: "Members trusted to moderate the host's live chat" })
  async listModerators(@CurrentUser("memberId") hostId: string): Promise<LiveModeratorList> {
    return { moderators: await this.live.listModerators(hostId) };
  }

  @ApiBearerAuth()
  @Put("me/live/moderators")
  @ApiOperation({ summary: "Replace the host's live moderators" })
  async setModerators(
    @CurrentUser("memberId") hostId: string,
    @Body(new ZodValidationPipe(liveModeratorsSchema)) body: { memberIds: string[] },
    @Req() req: Request,
  ): Promise<LiveModeratorList> {
    const moderators: LiveHostPreview[] = await this.live.setModerators(
      hostId,
      body.memberIds,
      getRequestId(req),
    );
    return { moderators };
  }

  @ApiBearerAuth()
  @Get("live/:id/chat")
  @ApiOperation({ summary: "Recent live chat. Hidden lines are omitted." })
  listChat(
    @CurrentUser("memberId") viewerId: string,
    @Param("id") liveId: string,
    @Query("before") before?: string,
  ): Promise<LiveChatPage> {
    return this.chat.list(liveId, viewerId, before);
  }

  @ApiBearerAuth()
  @Post("live/:id/chat")
  @ApiOperation({ summary: "Send a live chat message" })
  sendChat(
    @CurrentUser("memberId") memberId: string,
    @Param("id") liveId: string,
    @Body(new ZodValidationPipe(liveChatSendSchema)) body: { body: string },
  ) {
    return this.chat.send(liveId, memberId, body.body);
  }

  @ApiBearerAuth()
  @Post("live/:id/chat/pin")
  @ApiOperation({ summary: "Pin or unpin a chat message" })
  pinChat(
    @CurrentUser("memberId") memberId: string,
    @Param("id") liveId: string,
    @Body(new ZodValidationPipe(liveChatPinSchema)) body: { messageId: string | null },
  ) {
    return this.chat.pin(liveId, memberId, body.messageId);
  }

  @ApiBearerAuth()
  @Post("live/:id/chat/hide")
  @ApiOperation({ summary: "Hide a chat message" })
  hideChat(
    @CurrentUser("memberId") memberId: string,
    @Param("id") liveId: string,
    @Body(new ZodValidationPipe(liveChatHideSchema)) body: { messageId: string },
  ): Promise<void> {
    return this.chat.hide(liveId, memberId, body.messageId);
  }

  @ApiBearerAuth()
  @Post("live/:id/timeout")
  @ApiOperation({ summary: "Time a viewer out of chat" })
  timeout(
    @CurrentUser("memberId") actorId: string,
    @Param("id") liveId: string,
    @Body(new ZodValidationPipe(liveTimeoutSchema)) body: { memberId: string; seconds: number },
  ): Promise<void> {
    return this.chat.timeout(liveId, actorId, body.memberId, body.seconds);
  }

  @ApiBearerAuth()
  @Post("live/:id/report")
  @ApiOperation({ summary: "Report a live or a chat line" })
  report(
    @CurrentUser("memberId") actorId: string,
    @Param("id") liveId: string,
    @Body(new ZodValidationPipe(liveReportSchema))
    body: { reasonCode: string; details: string; messageId?: string },
  ): Promise<void> {
    return this.chat.report(liveId, actorId, body);
  }

  @ApiBearerAuth()
  @Get("me/live/:id/replay-status")
  @ApiOperation({ summary: "Recording / replay status for a live the host just ended" })
  replayStatus(
    @CurrentUser("memberId") memberId: string,
    @Param("id") liveId: string,
  ): Promise<LiveReplayStatus> {
    return this.live.replayStatus(memberId, liveId);
  }

  @ApiBearerAuth()
  @Patch("me/live/:id/replay")
  @ApiOperation({ summary: "Publish, update, or discard a replay" })
  updateReplay(
    @CurrentUser("memberId") memberId: string,
    @Param("id") liveId: string,
    @Body(new ZodValidationPipe(liveReplaySchema)) body: z.infer<typeof liveReplaySchema>,
    @Req() req: Request,
  ): Promise<LiveReplayStatus> {
    return this.live.updateReplay(memberId, liveId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Get("me/live/reminders/:creatorId")
  @ApiOperation({ summary: "Whether the member asked to be reminded about this creator" })
  async reminderState(
    @CurrentUser("memberId") memberId: string,
    @Param("creatorId") creatorId: string,
  ): Promise<LiveReminderState> {
    return {
      creatorId,
      reminded: await this.reminders.isReminded(memberId, creatorId),
    };
  }

  @ApiBearerAuth()
  @Post("me/live/reminders/:creatorId")
  @ApiOperation({ summary: "Remind me when this creator goes live (public lives only)" })
  async remindOn(
    @CurrentUser("memberId") memberId: string,
    @Param("creatorId") creatorId: string,
  ): Promise<LiveReminderState> {
    return {
      creatorId,
      reminded: await this.reminders.setReminder(memberId, creatorId, true),
    };
  }

  @ApiBearerAuth()
  @Delete("me/live/reminders/:creatorId")
  @ApiOperation({ summary: "Stop Remind-me for this creator" })
  async remindOff(
    @CurrentUser("memberId") memberId: string,
    @Param("creatorId") creatorId: string,
  ): Promise<LiveReminderState> {
    return {
      creatorId,
      reminded: await this.reminders.setReminder(memberId, creatorId, false),
    };
  }

  @ApiBearerAuth()
  @Post("live/:id/metrics")
  @ApiOperation({ summary: "Host or viewer playback metrics (sendBeacon-friendly)" })
  recordMetrics(
    @CurrentUser("memberId") memberId: string,
    @Param("id") liveId: string,
    @Body(new ZodValidationPipe(liveMetricSchema)) body: z.infer<typeof liveMetricSchema>,
  ): Promise<void> {
    return this.metrics.record(liveId, memberId, body);
  }

  @ApiBearerAuth()
  @Get("me/live/:id/metrics")
  @ApiOperation({ summary: "Aggregated client metrics for the host summary" })
  metricsSummary(
    @CurrentUser("memberId") memberId: string,
    @Param("id") liveId: string,
  ): Promise<LiveMetricsSummary> {
    return this.live.summary(memberId, liveId).then(() => this.metrics.summary(liveId));
  }
}
