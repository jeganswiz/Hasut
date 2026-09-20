import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { StoriesService } from "./stories.service";

describe("StoriesService", () => {
  const prisma = {
    story: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    liveSession: { findMany: jest.fn() },
  };
  const configuration = { getPublicFlags: jest.fn() };
  const media = { photoUrl: jest.fn() };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn().mockReturnValue("") };

  async function service(): Promise<StoriesService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigurationService, useValue: configuration },
        { provide: MediaService, useValue: media },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return moduleRef.get(StoriesService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    configuration.getPublicFlags.mockResolvedValue({ flags: { "stories.live": true } });
    media.photoUrl.mockResolvedValue("https://cdn.example/img.jpg");
    audit.record.mockResolvedValue(undefined);
    config.get.mockReturnValue("");
    prisma.story.create.mockResolvedValue({
      id: "s1",
      memberId: "m1",
      kind: "IMAGE",
      imageMediaId: "img-1",
      videoMediaId: null,
      audioMediaId: null,
      hlsUrl: null,
      previewHlsUrl: null,
      expiresAt: new Date(Date.now() + 1000),
      moderationStatus: "ACTIVE",
      createdAt: new Date(),
    });
    prisma.liveSession.findMany.mockResolvedValue([]);
    prisma.story.findMany.mockResolvedValue([]);
  });

  it("creates an image story when the phase-2 flag is on", async () => {
    const stories = await service();
    const created = await stories.create("m1", { kind: "IMAGE", imageMediaId: "img-1" }, "req");
    expect(created.kind).toBe("IMAGE");
    expect(created.imageUrl).toBe("https://cdn.example/img.jpg");
  });

  it("rejects story create when the flag is off", async () => {
    configuration.getPublicFlags.mockResolvedValue({ flags: { "stories.live": false } });
    const stories = await service();
    await expect(
      stories.create("m1", { kind: "IMAGE", imageMediaId: "img-1" }, "req"),
    ).rejects.toBeInstanceOf(HasutHttpException);
  });

  it("prefers LIVE pin media over a video story", async () => {
    prisma.liveSession.findMany.mockResolvedValue([
      { memberId: "m1", previewHlsUrl: "/media/hls/live/a/preview.m3u8" },
    ]);
    prisma.story.findMany.mockResolvedValue([
      {
        memberId: "m1",
        kind: "VIDEO",
        previewHlsUrl: "/media/hls/s1/preview.m3u8",
        imageMediaId: null,
      },
    ]);
    const stories = await service();
    const pins = await stories.pinMediaForMembers(["m1"]);
    expect(pins.get("m1")?.kind).toBe("LIVE");
  });

  it("prefers a video story over a newer image story", async () => {
    prisma.liveSession.findMany.mockResolvedValue([]);
    prisma.story.findMany.mockResolvedValue([
      {
        memberId: "m1",
        kind: "IMAGE",
        previewHlsUrl: null,
        imageMediaId: "img-1",
      },
      {
        memberId: "m1",
        kind: "VIDEO",
        previewHlsUrl: "/media/hls/s1/preview.m3u8",
        imageMediaId: null,
      },
    ]);
    const stories = await service();
    const pins = await stories.pinMediaForMembers(["m1"]);
    expect(pins.get("m1")?.kind).toBe("VIDEO");
  });
});
