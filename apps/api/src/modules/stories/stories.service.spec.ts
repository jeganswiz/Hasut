import { STORY_POLICY_DEFAULTS } from "@hasut/config";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { AudioLibraryService } from "./audio-library.service";
import { PatronsService } from "./patrons.service";
import { StoriesService } from "./stories.service";

describe("StoriesService", () => {
  const prisma = {
    story: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    liveSession: { findMany: jest.fn() },
    audioTrack: { findUnique: jest.fn() },
  };
  const configuration = { getPublicFlags: jest.fn(), getStoryPolicy: jest.fn() };
  const media = { photoUrl: jest.fn() };
  const audit = { record: jest.fn() };
  const audioLibrary = { requirePlayable: jest.fn() };
  const patrons = { isPatronOf: jest.fn(), countFor: jest.fn(), patronOwnersAmong: jest.fn() };
  const config = { get: jest.fn().mockReturnValue("") };

  async function service(): Promise<StoriesService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigurationService, useValue: configuration },
        { provide: MediaService, useValue: media },
        { provide: AuditService, useValue: audit },
        { provide: AudioLibraryService, useValue: audioLibrary },
        { provide: PatronsService, useValue: patrons },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return moduleRef.get(StoriesService);
  }

  /** Mirrors what Prisma hands back so `toView` has every column it reads. */
  function storyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "s1",
      memberId: "m1",
      kind: "IMAGE",
      imageMediaId: "img-1",
      videoMediaId: null,
      audioMediaId: null,
      audioSource: "NONE",
      audioTrackId: null,
      audioStartSeconds: 0,
      audioEndSeconds: null,
      originalAudioMode: "KEEP",
      audience: "EVERYONE",
      caption: "",
      captionColor: null,
      trimStartSeconds: 0,
      trimEndSeconds: null,
      hlsUrl: null,
      previewHlsUrl: null,
      expiresAt: new Date(Date.now() + 1000),
      moderationStatus: "ACTIVE",
      createdAt: new Date(),
      ...overrides,
    };
  }

  /** Returns the `data` object the service asked Prisma to persist. */
  function persisted(): Record<string, unknown> {
    const call = prisma.story.create.mock.calls[0][0] as { data: Record<string, unknown> };
    return call.data;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    configuration.getPublicFlags.mockResolvedValue({ flags: { "stories.live": true } });
    configuration.getStoryPolicy.mockResolvedValue(STORY_POLICY_DEFAULTS);
    media.photoUrl.mockResolvedValue("https://cdn.example/img.jpg");
    audit.record.mockResolvedValue(undefined);
    config.get.mockReturnValue("");
    prisma.story.create.mockImplementation(async (args: { data: Record<string, unknown> }) =>
      storyRow(args.data),
    );
    prisma.liveSession.findMany.mockResolvedValue([]);
    prisma.story.findMany.mockResolvedValue([]);
    patrons.isPatronOf.mockResolvedValue(false);
    patrons.countFor.mockResolvedValue(0);
    patrons.patronOwnersAmong.mockResolvedValue(new Set<string>());
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

  describe("composer fields", () => {
    it("stores caption, palette colour, and trim on a video story", async () => {
      const stories = await service();
      const created = await stories.create(
        "m1",
        {
          kind: "VIDEO",
          videoMediaId: "vid-1",
          caption: "  Rewiring a shop board  ",
          captionColor: "#EAB308",
          trimStartSeconds: 3,
          trimEndSeconds: 18,
        },
        "req",
      );

      expect(persisted()).toMatchObject({
        caption: "Rewiring a shop board",
        captionColor: "#EAB308",
        trimStartSeconds: 3,
        trimEndSeconds: 18,
      });
      expect(created.trimEndSeconds).toBe(18);
      expect(created.caption).toBe("Rewiring a shop board");
    });

    it("refuses a caption colour that is not in the palette", async () => {
      const stories = await service();
      await expect(
        stories.create(
          "m1",
          { kind: "IMAGE", imageMediaId: "img-1", captionColor: "#123456" },
          "req",
        ),
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
    });

    it("refuses a clip longer than the configured cap", async () => {
      const stories = await service();
      await expect(
        stories.create(
          "m1",
          { kind: "VIDEO", videoMediaId: "vid-1", trimStartSeconds: 0, trimEndSeconds: 600 },
          "req",
        ),
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
    });

    it("refuses a clip that ends before it starts", async () => {
      const stories = await service();
      await expect(
        stories.create(
          "m1",
          { kind: "VIDEO", videoMediaId: "vid-1", trimStartSeconds: 10, trimEndSeconds: 4 },
          "req",
        ),
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
    });
  });

  describe("soundtrack", () => {
    it("attaches a library track and clamps the segment to the track length", async () => {
      const row = {
        id: "track-1",
        title: "Marina Morning",
        artist: "HASUT Sound",
        mediaId: "audio-1",
        durationSeconds: 20,
        mood: "Calm",
        isActive: true,
      };
      audioLibrary.requirePlayable.mockResolvedValue(row);
      prisma.audioTrack.findUnique.mockResolvedValue(row);
      const stories = await service();
      await stories.create(
        "m1",
        {
          kind: "VIDEO",
          videoMediaId: "vid-1",
          audio: { source: "LIBRARY", trackId: "track-1", startSeconds: 5, endSeconds: 30 },
          originalAudioMode: "MUTE",
        },
        "req",
      );

      expect(persisted()).toMatchObject({
        audioSource: "LIBRARY",
        audioTrackId: "track-1",
        audioMediaId: null,
        audioStartSeconds: 5,
        audioEndSeconds: 20,
        originalAudioMode: "MUTE",
      });
    });

    it("refuses a retired library track", async () => {
      audioLibrary.requirePlayable.mockRejectedValue(
        Object.assign(new Error("gone"), { errorCode: "VALIDATION_ERROR" }),
      );
      const stories = await service();
      await expect(
        stories.create(
          "m1",
          {
            kind: "VIDEO",
            videoMediaId: "vid-1",
            audio: { source: "LIBRARY", trackId: "track-9" },
          },
          "req",
        ),
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
    });

    it("refuses an audio segment longer than the configured cap", async () => {
      const stories = await service();
      await expect(
        stories.create(
          "m1",
          {
            kind: "VIDEO",
            videoMediaId: "vid-1",
            audio: { source: "UPLOAD", mediaId: "audio-1", startSeconds: 0, endSeconds: 120 },
          },
          "req",
        ),
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
      expect(audioLibrary.requirePlayable).not.toHaveBeenCalled();
    });

    it("keeps an uploaded track on the story", async () => {
      const stories = await service();
      await stories.create(
        "m1",
        {
          kind: "VIDEO",
          videoMediaId: "vid-1",
          audio: { source: "UPLOAD", mediaId: "audio-1", startSeconds: 2, endSeconds: 12 },
          originalAudioMode: "OVERLAY",
        },
        "req",
      );

      expect(persisted()).toMatchObject({
        audioSource: "UPLOAD",
        audioMediaId: "audio-1",
        audioTrackId: null,
        originalAudioMode: "OVERLAY",
      });
    });

    it("keeps the caption text out of the audit trail", async () => {
      const stories = await service();
      await stories.create(
        "m1",
        { kind: "IMAGE", imageMediaId: "img-1", caption: "my private note" },
        "req",
      );
      const entry = audit.record.mock.calls[0][0] as { afterJson: Record<string, unknown> };
      expect(entry.afterJson).toMatchObject({ hasCaption: true });
      expect(JSON.stringify(entry.afterJson)).not.toContain("private");
    });
  });

  it("prefers LIVE pin media over a video story", async () => {
    prisma.liveSession.findMany.mockResolvedValue([
      { memberId: "m1", audience: "EVERYONE", previewHlsUrl: "/media/hls/live/a/preview.m3u8" },
    ]);
    prisma.story.findMany.mockResolvedValue([
      {
        memberId: "m1",
        kind: "VIDEO",
        audience: "EVERYONE",
        previewHlsUrl: "/media/hls/s1/preview.m3u8",
        imageMediaId: null,
      },
    ]);
    const stories = await service();
    const pins = await stories.pinMediaForMembers(["m1"], "viewer");
    expect(pins.get("m1")?.kind).toBe("LIVE");
  });

  it("prefers a video story over a newer image story", async () => {
    prisma.liveSession.findMany.mockResolvedValue([]);
    prisma.story.findMany.mockResolvedValue([
      {
        memberId: "m1",
        kind: "IMAGE",
        audience: "EVERYONE",
        previewHlsUrl: null,
        imageMediaId: "img-1",
      },
      {
        memberId: "m1",
        kind: "VIDEO",
        audience: "EVERYONE",
        previewHlsUrl: "/media/hls/s1/preview.m3u8",
        imageMediaId: null,
      },
    ]);
    const stories = await service();
    const pins = await stories.pinMediaForMembers(["m1"], "viewer");
    expect(pins.get("m1")?.kind).toBe("VIDEO");
  });

  describe("audience", () => {
    it("stores the chosen audience", async () => {
      const stories = await service();
      await stories.create(
        "m1",
        { kind: "IMAGE", imageMediaId: "img-1", audience: "PATRONS" },
        "req",
      );
      expect(persisted()).toMatchObject({ audience: "PATRONS" });
    });

    it("defaults to EVERYONE when the composer sends nothing", async () => {
      const stories = await service();
      await stories.create("m1", { kind: "IMAGE", imageMediaId: "img-1" }, "req");
      expect(persisted()).toMatchObject({ audience: "EVERYONE" });
    });

    it("asks only for public stories when the viewer is not a Patron", async () => {
      patrons.isPatronOf.mockResolvedValue(false);
      const stories = await service();
      await stories.listForViewer("owner", "stranger");

      expect(prisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ audience: { in: ["EVERYONE"] } }),
        }),
      );
    });

    it("includes Patrons-only stories once the viewer is a Patron", async () => {
      patrons.isPatronOf.mockResolvedValue(true);
      const stories = await service();
      await stories.listForViewer("owner", "patron");

      expect(prisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ audience: { in: ["EVERYONE", "PATRONS"] } }),
        }),
      );
    });

    it("hides a Patrons-only story from a stranger's map pin", async () => {
      patrons.patronOwnersAmong.mockResolvedValue(new Set<string>());
      prisma.liveSession.findMany.mockResolvedValue([]);
      prisma.story.findMany.mockResolvedValue([
        {
          memberId: "m1",
          kind: "IMAGE",
          audience: "PATRONS",
          previewHlsUrl: null,
          imageMediaId: "img-1",
        },
      ]);
      const stories = await service();
      const pins = await stories.pinMediaForMembers(["m1"], "stranger");
      expect(pins.has("m1")).toBe(false);
    });

    it("shows the same pin to a Patron", async () => {
      patrons.patronOwnersAmong.mockResolvedValue(new Set(["m1"]));
      prisma.liveSession.findMany.mockResolvedValue([]);
      prisma.story.findMany.mockResolvedValue([
        {
          memberId: "m1",
          kind: "IMAGE",
          audience: "PATRONS",
          previewHlsUrl: null,
          imageMediaId: "img-1",
        },
      ]);
      const stories = await service();
      const pins = await stories.pinMediaForMembers(["m1"], "patron");
      expect(pins.get("m1")?.kind).toBe("IMAGE");
    });

    it("hides a Patrons-only live preview from a stranger", async () => {
      patrons.patronOwnersAmong.mockResolvedValue(new Set<string>());
      prisma.liveSession.findMany.mockResolvedValue([
        { memberId: "m1", audience: "PATRONS", previewHlsUrl: "/media/hls/live/a/preview.m3u8" },
      ]);
      prisma.story.findMany.mockResolvedValue([]);
      const stories = await service();
      const pins = await stories.pinMediaForMembers(["m1"], "stranger");
      expect(pins.has("m1")).toBe(false);
    });

    it("treats a signed-out viewer as nobody's Patron", async () => {
      prisma.liveSession.findMany.mockResolvedValue([]);
      prisma.story.findMany.mockResolvedValue([
        {
          memberId: "m1",
          kind: "IMAGE",
          audience: "PATRONS",
          previewHlsUrl: null,
          imageMediaId: "img-1",
        },
      ]);
      const stories = await service();
      const pins = await stories.pinMediaForMembers(["m1"], null);

      expect(pins.has("m1")).toBe(false);
      expect(patrons.patronOwnersAmong).not.toHaveBeenCalled();
    });
  });
});
