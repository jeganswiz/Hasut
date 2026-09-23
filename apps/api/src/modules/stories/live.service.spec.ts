import { STORY_POLICY_DEFAULTS } from "@hasut/config";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { PrismaService } from "../prisma/prisma.service";
import { LiveService } from "./live.service";
import { PatronsService } from "./patrons.service";
import { StoriesService } from "./stories.service";

describe("LiveService", () => {
  const prisma = {
    liveSession: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };
  const stories = { assertEnabled: jest.fn() };
  const patrons = { isPatronOf: jest.fn() };
  const configuration = { getStoryPolicy: jest.fn() };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn().mockReturnValue("") };

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
      ],
    }).compile();
    return moduleRef.get(LiveService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    stories.assertEnabled.mockResolvedValue(undefined);
    patrons.isPatronOf.mockResolvedValue(false);
    configuration.getStoryPolicy.mockResolvedValue(STORY_POLICY_DEFAULTS);
    prisma.liveSession.count.mockResolvedValue(0);
    audit.record.mockResolvedValue(undefined);
    config.get.mockReturnValue("");
  });

  function startedRow(title = "", audience = "EVERYONE"): Record<string, unknown> {
    return {
      id: "live-1",
      memberId: "m1",
      title,
      audience,
      status: "LIVE",
      hlsUrl: "/media/hls/live/live-1/index.m3u8",
      previewHlsUrl: "/media/hls/live/live-1/preview.m3u8",
      ingestUrl: "/media/hls/whip/live-1",
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
    expect(created.title).toBe("");
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

  it("refuses another live once the hourly cap is full", async () => {
    prisma.liveSession.count.mockResolvedValue(STORY_POLICY_DEFAULTS.maxLiveStartsPerHour);
    const live = await service();
    await expect(live.start("m1", { title: "Again" }, "req")).rejects.toBeInstanceOf(
      HasutHttpException,
    );
    expect(prisma.liveSession.create).not.toHaveBeenCalled();
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
    });
    const live = await service();
    const ended = await live.endById("mod-1", ["MODERATOR"], "live-1", "req");
    expect(ended.status).toBe("ENDED");
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

  it("returns nothing when the member is not live", async () => {
    prisma.liveSession.findFirst.mockResolvedValue(null);
    const live = await service();
    await expect(live.current("m1")).resolves.toBeNull();
    await expect(live.forViewer("m1", "viewer")).resolves.toBeNull();
  });
});
