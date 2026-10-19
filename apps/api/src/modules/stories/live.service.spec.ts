import { LIVE_POLICY_DEFAULTS, STORY_POLICY_DEFAULTS } from "@hasut/config";
import { Prisma } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { LiveViewerRegistry } from "../realtime/live-viewer-registry";
import { RealtimeEvents } from "../realtime/realtime.events";
import { ReportsService } from "../reports/reports.service";
import { LiveNotificationsService } from "./live-notifications.service";
import { LiveService } from "./live.service";
import { PatronsService } from "./patrons.service";
import { StoriesService } from "./stories.service";

describe("LiveService", () => {
  const prisma = {
    liveSession: {
      updateMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    liveInvite: { createMany: jest.fn(), findUnique: jest.fn() },
    story: { findUnique: jest.fn() },
    liveModerator: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const stories = { assertEnabled: jest.fn() };
  const patrons = { isPatronOf: jest.fn(), countFor: jest.fn(), patronOwnersAmong: jest.fn() };
  const configuration = { getStoryPolicy: jest.fn(), getLivePolicy: jest.fn() };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn() };
  const profiles = { getPreview: jest.fn() };
  const media = { photoUrl: jest.fn() };
  const reports = { isBlockedEitherWay: jest.fn() };
  const viewers = { count: jest.fn(), clear: jest.fn() };
  const realtime = { publishRoom: jest.fn() };
  const notifications = { notifyStarted: jest.fn(), notifyReplayPublished: jest.fn() };

  async function service(): Promise<LiveService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LiveService,
        { provide: PrismaService, useValue: prisma },
        { provide: StoriesService, useValue: stories },
        { provide: PatronsService, useValue: patrons },
        { provide: ConfigurationService, useValue: configuration },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: config },
        { provide: ProfilesService, useValue: profiles },
        { provide: MediaService, useValue: media },
        { provide: ReportsService, useValue: reports },
        { provide: LiveViewerRegistry, useValue: viewers },
        { provide: RealtimeEvents, useValue: realtime },
        { provide: LiveNotificationsService, useValue: notifications },
      ],
    }).compile();
    return moduleRef.get(LiveService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    stories.assertEnabled.mockResolvedValue(undefined);
    patrons.isPatronOf.mockResolvedValue(false);
    patrons.countFor.mockResolvedValue(2);
    patrons.patronOwnersAmong.mockResolvedValue(new Set<string>());
    configuration.getStoryPolicy.mockResolvedValue(STORY_POLICY_DEFAULTS);
    configuration.getLivePolicy.mockResolvedValue(LIVE_POLICY_DEFAULTS);
    prisma.liveSession.count.mockResolvedValue(0);
    prisma.liveInvite.createMany.mockResolvedValue({ count: 0 });
    audit.record.mockResolvedValue(undefined);
    config.get.mockReturnValue("");
    profiles.getPreview.mockImplementation(async (id: string) => ({
      id,
      displayName: "Ada",
      photoUrl: null,
    }));
    media.photoUrl.mockResolvedValue(null);
    reports.isBlockedEitherWay.mockResolvedValue(false);
    viewers.count.mockReturnValue(0);
    prisma.story.findUnique.mockResolvedValue(null);
    notifications.notifyStarted.mockResolvedValue(1);
  });

  function startedRow(title = "", audience = "EVERYONE"): Record<string, unknown> {
    return {
      id: "live-1",
      memberId: "m1",
      title,
      description: "",
      category: null,
      thumbnailMediaId: null,
      audience,
      status: "LIVE",
      scheduledFor: null,
      hlsUrl: "/media/hls/live/live-1/index.m3u8",
      previewHlsUrl: "/media/hls/live/live-1/index.m3u8",
      ingestUrl: "/media/whip/live/live-1/whip",
      chatEnabled: true,
      chatPatronsOnly: false,
      slowModeSeconds: 0,
      blockedWords: [],
      recordingEnabled: false,
      recordingStatus: "NONE",
      replayStoryId: null,
      lastHeartbeatAt: new Date("2026-09-20T00:00:00.000Z"),
      peakViewers: 0,
      totalViews: 0,
      reactionCount: 0,
      messageCount: 0,
      endedReason: null,
      startedAt: new Date("2026-09-20T00:00:00.000Z"),
      endedAt: null,
    };
  }

  it("starts a live session with HLS playback URLs", async () => {
    prisma.liveSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.liveSession.create.mockResolvedValue(startedRow());
    const live = await service();
    const created = await live.start("m1", {}, "req");
    expect(prisma.liveSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hlsUrl: expect.stringContaining("/live/"),
          previewHlsUrl: expect.stringContaining("/index.m3u8"),
          ingestUrl: expect.stringContaining("/media/whip/"),
        }),
      }),
    );
    expect(created.status).toBe("LIVE");
    expect(created.host.displayName).toBe("Ada");
  });

  it("stores the title the member typed instead of discarding it", async () => {
    prisma.liveSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.liveSession.create.mockResolvedValue(startedRow("Rewiring a shop board"));
    const live = await service();
    const created = await live.start("m1", { title: "  Rewiring a shop board  " }, "req");
    expect(prisma.liveSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Rewiring a shop board" }),
      }),
    );
    expect(created.title).toBe("Rewiring a shop board");
  });

  it("keeps a live restricted to Patrons when that is what the member picked", async () => {
    prisma.liveSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.liveSession.create.mockResolvedValue(startedRow("Shop board", "PATRONS"));
    const live = await service();
    const created = await live.start("m1", { title: "Shop board", audience: "PATRONS" }, "req");
    expect(prisma.liveSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ audience: "PATRONS" }) }),
    );
    expect(created.audience).toBe("PATRONS");
  });

  it("refuses a PRIVATE invite list that is not all Patrons", async () => {
    patrons.patronOwnersAmong.mockResolvedValue(new Set<string>());
    const live = await service();
    await expect(
      live.start("m1", { audience: "PRIVATE", inviteeIds: ["p1"] }, "req"),
    ).rejects.toBeInstanceOf(HasutHttpException);
    expect(prisma.liveSession.create).not.toHaveBeenCalled();
  });

  it("saves PRIVATE invites when every invitee is a Patron", async () => {
    patrons.patronOwnersAmong.mockResolvedValue(new Set(["p1"]));
    prisma.liveSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.liveSession.create.mockResolvedValue(startedRow("Private", "PRIVATE"));
    const live = await service();
    await live.start("m1", { audience: "PRIVATE", inviteeIds: ["p1"] }, "req");
    expect(prisma.liveInvite.createMany).toHaveBeenCalledWith({
      data: [{ liveId: expect.any(String) as string, memberId: "p1" }],
      skipDuplicates: true,
    });
  });

  it("turns a unique-index race into CONFLICT", async () => {
    prisma.liveSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.liveSession.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }),
    );
    const live = await service();
    await expect(live.start("m1", {}, "req")).rejects.toMatchObject({ errorCode: "CONFLICT" });
  });

  it("refuses another live once the hourly cap is full", async () => {
    prisma.liveSession.count.mockResolvedValue(STORY_POLICY_DEFAULTS.maxLiveStartsPerHour);
    const live = await service();
    await expect(live.start("m1", { title: "Again" }, "req")).rejects.toBeInstanceOf(
      HasutHttpException,
    );
    expect(prisma.liveSession.create).not.toHaveBeenCalled();
  });

  it("rejects a title longer than the live policy", async () => {
    const live = await service();
    await expect(
      live.start("m1", { title: "x".repeat(LIVE_POLICY_DEFAULTS.titleMaxLength + 1) }, "req"),
    ).rejects.toBeInstanceOf(HasutHttpException);
  });

  it("defaults a live to everyone", async () => {
    prisma.liveSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.liveSession.create.mockResolvedValue(startedRow("Open house"));
    const live = await service();
    await live.start("m1", { title: "Open house" }, "req");
    expect(prisma.liveSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ audience: "EVERYONE" }) }),
    );
  });

  it("rejects member-role moderation of someone else's live session", async () => {
    const live = await service();
    await expect(live.endById("m1", ["MEMBER"], "live-1", "req")).rejects.toBeInstanceOf(
      HasutHttpException,
    );
    expect(prisma.liveSession.update).not.toHaveBeenCalled();
  });

  it("lets a moderator end a live session", async () => {
    prisma.liveSession.findUnique.mockResolvedValue(startedRow("Live from the shop"));
    prisma.liveSession.update.mockResolvedValue({
      ...startedRow("Live from the shop"),
      status: "ENDED",
      endedAt: new Date("2026-09-20T00:10:00.000Z"),
      endedReason: "MODERATOR",
    });
    const live = await service();
    const ended = await live.endById("mod-1", ["MODERATOR"], "live-1", "req");
    expect(ended.status).toBe("ENDED");
    expect(ended.endedReason).toBe("MODERATOR");
    expect(audit.record).toHaveBeenCalled();
  });

  it("restores the owner's live session including the ingest URL", async () => {
    prisma.liveSession.findFirst.mockResolvedValue(startedRow("Shop board"));
    const live = await service();
    const current = await live.current("m1");
    expect(current?.title).toBe("Shop board");
    expect(current?.ingestUrl).toContain("whip");
  });

  it("hides a Patrons-only live from a stranger and strips ingest from a Patron", async () => {
    prisma.liveSession.findFirst.mockResolvedValue(startedRow("Shop board", "PATRONS"));
    const live = await service();
    await expect(live.forViewer("m1", "stranger")).resolves.toBeNull();
    patrons.isPatronOf.mockResolvedValue(true);
    const visible = await live.forViewer("m1", "patron");
    expect(visible?.title).toBe("Shop board");
    expect(visible?.ingestUrl).toBeNull();
  });

  it("hides a live from a blocked viewer", async () => {
    prisma.liveSession.findFirst.mockResolvedValue(startedRow("Shop board"));
    reports.isBlockedEitherWay.mockResolvedValue(true);
    const live = await service();
    await expect(live.forViewer("m1", "blocked")).resolves.toBeNull();
  });

  it("opens a PRIVATE live only for an invited Patron", async () => {
    prisma.liveSession.findFirst.mockResolvedValue(startedRow("Private", "PRIVATE"));
    prisma.liveInvite.findUnique.mockResolvedValue(null);
    const live = await service();
    await expect(live.forViewer("m1", "stranger")).resolves.toBeNull();
    prisma.liveInvite.findUnique.mockResolvedValue({ liveId: "live-1" });
    const invited = await live.forViewer("m1", "p1");
    expect(invited?.title).toBe("Private");
  });

  it("writes a heartbeat timestamp", async () => {
    prisma.liveSession.findFirst.mockResolvedValue(startedRow("Shop"));
    prisma.liveSession.update.mockResolvedValue(startedRow("Shop"));
    const live = await service();
    await live.heartbeat("m1");
    expect(prisma.liveSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastHeartbeatAt: expect.any(Date) as Date }),
      }),
    );
  });

  it("ends an idle session with IDLE_TIMEOUT", async () => {
    prisma.liveSession.findUnique.mockResolvedValue(startedRow("Shop"));
    prisma.liveSession.update.mockResolvedValue({
      ...startedRow("Shop"),
      status: "ENDED",
      endedReason: "IDLE_TIMEOUT",
      endedAt: new Date(),
    });
    const live = await service();
    const ended = await live.endIdle("live-1");
    expect(ended?.endedReason).toBe("IDLE_TIMEOUT");
    expect(viewers.clear).toHaveBeenCalledWith("live-1");
  });

  it("returns nothing when the member is not live", async () => {
    prisma.liveSession.findFirst.mockResolvedValue(null);
    const live = await service();
    await expect(live.current("m1")).resolves.toBeNull();
    await expect(live.forViewer("m1", "viewer")).resolves.toBeNull();
  });
});
