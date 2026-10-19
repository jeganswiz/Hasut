import { containsBlockedWord } from "@hasut/config";
import type { LiveChatMessageView, LiveChatPage } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { RedisService } from "../redis/redis.service";
import { ReportsService } from "../reports/reports.service";
import { PatronsService } from "../stories/patrons.service";
import { LiveService } from "../stories/live.service";

const CHAT_PAGE = 40;

@Injectable()
export class LiveChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveService,
    private readonly patrons: PatronsService,
    private readonly profiles: ProfilesService,
    private readonly configuration: ConfigurationService,
    private readonly redis: RedisService,
    private readonly reports: ReportsService,
  ) {}

  async list(liveId: string, viewerId: string, before?: string): Promise<LiveChatPage> {
    const row = await this.requireWatchable(liveId, viewerId);
    const messages = await this.prisma.liveChatMessage.findMany({
      where: {
        liveId,
        hiddenAt: null,
        ...(before === undefined ? {} : { createdAt: { lt: new Date(before) } }),
      },
      orderBy: { createdAt: "desc" },
      take: CHAT_PAGE + 1,
    });
    const page = messages.slice(0, CHAT_PAGE);
    const pinnedRow = await this.prisma.liveChatMessage.findFirst({
      where: { liveId, pinned: true, hiddenAt: null },
      orderBy: { createdAt: "desc" },
    });
    return {
      messages: await Promise.all(page.reverse().map((item) => this.toView(item, row.memberId))),
      nextCursor: messages.length > CHAT_PAGE ? (page[0]?.createdAt.toISOString() ?? null) : null,
      pinned: pinnedRow === null ? null : await this.toView(pinnedRow, row.memberId),
    };
  }

  async send(liveId: string, memberId: string, body: string): Promise<LiveChatMessageView> {
    const row = await this.requireLive(liveId, memberId);
    const policy = await this.configuration.getLivePolicy();
    await this.assertCanChat(row, memberId);
    const text = body.trim();
    if (text.length === 0 || text.length > policy.chatMaxChars) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        `Keep chat under ${policy.chatMaxChars} characters`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const blocked = [...policy.blockedWords, ...row.blockedWords];
    if (containsBlockedWord(text, blocked)) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "That message uses a blocked word",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertRate(`live:chat:${liveId}:${memberId}`, policy.chatMessagesPerMinute, 60);
    if (row.slowModeSeconds > 0 && memberId !== row.memberId) {
      await this.assertRate(`live:slow:${liveId}:${memberId}`, 1, row.slowModeSeconds);
    }
    const created = await this.prisma.liveChatMessage.create({
      data: { liveId, memberId, body: text },
    });
    await this.live.addMessage(liveId);
    return this.toView(created, row.memberId);
  }

  async react(liveId: string, memberId: string, emoji: string): Promise<void> {
    const row = await this.requireLive(liveId, memberId);
    if (!(await this.live.canWatch(row, memberId))) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    const policy = await this.configuration.getLivePolicy();
    await this.assertRate(`live:react:${liveId}:${memberId}`, policy.reactionsPerMinute, 60);
    await this.live.addReactions(liveId, 1);
    void emoji;
  }

  async pin(
    liveId: string,
    actorId: string,
    messageId: string | null,
  ): Promise<LiveChatMessageView | null> {
    const row = await this.requireLive(liveId, actorId);
    await this.assertModerator(row.memberId, actorId);
    await this.prisma.liveChatMessage.updateMany({
      where: { liveId, pinned: true },
      data: { pinned: false },
    });
    if (messageId === null) {
      return null;
    }
    const message = await this.prisma.liveChatMessage.findFirst({
      where: { id: messageId, liveId, hiddenAt: null },
    });
    if (message === null) {
      throw new HasutHttpException("NOT_FOUND", "Message not found", HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.liveChatMessage.update({
      where: { id: message.id },
      data: { pinned: true },
    });
    return this.toView(updated, row.memberId);
  }

  async hide(liveId: string, actorId: string, messageId: string): Promise<void> {
    const row = await this.requireLive(liveId, actorId);
    await this.assertModerator(row.memberId, actorId);
    const result = await this.prisma.liveChatMessage.updateMany({
      where: { id: messageId, liveId, hiddenAt: null },
      data: { hiddenAt: new Date(), pinned: false },
    });
    if (result.count === 0) {
      throw new HasutHttpException("NOT_FOUND", "Message not found", HttpStatus.NOT_FOUND);
    }
  }

  async timeout(liveId: string, actorId: string, memberId: string, seconds: number): Promise<void> {
    const row = await this.requireLive(liveId, actorId);
    await this.assertModerator(row.memberId, actorId);
    if (memberId === row.memberId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "You cannot time out the host",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.redis.set(`live:timeout:${liveId}:${memberId}`, "1", seconds);
  }

  async report(
    liveId: string,
    actorId: string,
    input: { reasonCode: string; details: string; messageId?: string },
  ): Promise<void> {
    await this.requireWatchable(liveId, actorId);
    await this.reports.createReport(actorId, {
      targetType: input.messageId === undefined ? "LIVE" : "LIVE_CHAT_MESSAGE",
      targetId: input.messageId ?? liveId,
      reasonCode: input.reasonCode,
      details: input.details,
    });
  }

  private async assertCanChat(
    row: {
      id: string;
      memberId: string;
      audience: string;
      chatEnabled: boolean;
      chatPatronsOnly: boolean;
      status: string;
    },
    memberId: string,
  ): Promise<void> {
    if (row.status !== "LIVE") {
      throw new HasutHttpException("CONFLICT", "This live has ended", HttpStatus.CONFLICT);
    }
    if (!row.chatEnabled) {
      throw new HasutHttpException("FORBIDDEN", "Chat is off", HttpStatus.FORBIDDEN);
    }
    if (!(await this.live.canWatch(row, memberId))) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    if (row.chatPatronsOnly && !(await this.patrons.isPatronOf(row.memberId, memberId))) {
      throw new HasutHttpException("FORBIDDEN", "Chat is for Patrons", HttpStatus.FORBIDDEN);
    }
    const timedOut = await this.redis.get(`live:timeout:${row.id}:${memberId}`);
    if (timedOut !== null) {
      throw new HasutHttpException(
        "RATE_LIMITED",
        "You are timed out from chat",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async assertRate(key: string, max: number, windowSeconds: number): Promise<void> {
    const count = await this.redis.incrementWithTtl(key, windowSeconds);
    if (count > max) {
      throw new HasutHttpException(
        "RATE_LIMITED",
        "You are sending too quickly",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async assertModerator(hostId: string, actorId: string): Promise<void> {
    if (!(await this.live.isModerator(hostId, actorId))) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "Only the host or a moderator can do that",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async requireWatchable(liveId: string, viewerId: string) {
    const row = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (row === null || !(await this.live.canWatch(row, viewerId))) {
      throw new HasutHttpException("NOT_FOUND", "No live session", HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async requireLive(liveId: string, viewerId: string) {
    const row = await this.requireWatchable(liveId, viewerId);
    if (row.status !== "LIVE") {
      throw new HasutHttpException("CONFLICT", "This live has ended", HttpStatus.CONFLICT);
    }
    return row;
  }

  private async toView(
    row: {
      id: string;
      liveId: string;
      memberId: string;
      body: string;
      pinned: boolean;
      createdAt: Date;
    },
    hostId: string,
  ): Promise<LiveChatMessageView> {
    const [member, isPatron, isModerator] = await Promise.all([
      this.profiles.getPreview(row.memberId),
      this.patrons.isPatronOf(hostId, row.memberId),
      this.live.isModerator(hostId, row.memberId),
    ]);
    return {
      id: row.id,
      liveId: row.liveId,
      member,
      body: row.body,
      pinned: row.pinned,
      isHost: row.memberId === hostId,
      isPatron,
      isModerator,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
