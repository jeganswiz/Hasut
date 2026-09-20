import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { LiveService } from "./live.service";
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
    },
  };
  const stories = { assertEnabled: jest.fn() };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn().mockReturnValue("") };

  async function service(): Promise<LiveService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LiveService,
        { provide: PrismaService, useValue: prisma },
        { provide: StoriesService, useValue: stories },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return moduleRef.get(LiveService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    stories.assertEnabled.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
    config.get.mockReturnValue("");
  });

  it("starts a live session with HLS playback URLs", async () => {
    prisma.liveSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.liveSession.create.mockResolvedValue({
      id: "live-1",
      memberId: "m1",
      status: "LIVE",
      hlsUrl: "/media/hls/live/live-1/index.m3u8",
      previewHlsUrl: "/media/hls/live/live-1/preview.m3u8",
      ingestUrl: "/media/hls/whip/live-1",
      startedAt: new Date("2026-09-20T00:00:00.000Z"),
      endedAt: null,
    });
    const live = await service();
    const created = await live.start("m1", "req");
    expect(created.status).toBe("LIVE");
    expect(created.previewHlsUrl).toContain("preview.m3u8");
  });

  it("rejects member-role moderation of someone else's live session", async () => {
    const live = await service();
    await expect(live.endById("m1", ["MEMBER"], "live-1", "req")).rejects.toBeInstanceOf(
      HasutHttpException,
    );
    expect(prisma.liveSession.update).not.toHaveBeenCalled();
  });

  it("lets a moderator end a live session", async () => {
    prisma.liveSession.findUnique.mockResolvedValue({
      id: "live-1",
      memberId: "m1",
      status: "LIVE",
      hlsUrl: "/a.m3u8",
      previewHlsUrl: "/p.m3u8",
      ingestUrl: "/whip",
      startedAt: new Date("2026-09-20T00:00:00.000Z"),
      endedAt: null,
    });
    prisma.liveSession.update.mockResolvedValue({
      id: "live-1",
      memberId: "m1",
      status: "ENDED",
      hlsUrl: "/a.m3u8",
      previewHlsUrl: "/p.m3u8",
      ingestUrl: "/whip",
      startedAt: new Date("2026-09-20T00:00:00.000Z"),
      endedAt: new Date("2026-09-20T00:10:00.000Z"),
    });
    const live = await service();
    const ended = await live.endById("mod-1", ["MODERATOR"], "live-1", "req");
    expect(ended.status).toBe("ENDED");
    expect(audit.record).toHaveBeenCalled();
  });
});
