import { STORY_POLICY_DEFAULTS } from "@hasut/config";
import { Test } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { AudioLibraryService } from "./audio-library.service";

describe("AudioLibraryService", () => {
  const prisma = {
    audioTrack: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const configuration = { getStoryPolicy: jest.fn() };
  const media = { photoUrl: jest.fn() };
  const audit = { record: jest.fn() };

  function track(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "track-1",
      title: "Marina Morning",
      artist: "HASUT Sound",
      mediaId: "audio-1",
      durationSeconds: 30,
      mood: "Calm",
      isActive: true,
      ...overrides,
    };
  }

  async function service(): Promise<AudioLibraryService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AudioLibraryService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigurationService, useValue: configuration },
        { provide: MediaService, useValue: media },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return moduleRef.get(AudioLibraryService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    configuration.getStoryPolicy.mockResolvedValue(STORY_POLICY_DEFAULTS);
    media.photoUrl.mockResolvedValue("https://cdn.example/audio.m4a");
    audit.record.mockResolvedValue(undefined);
  });

  it("returns only active tracks to members", async () => {
    prisma.audioTrack.findMany.mockResolvedValue([track()]);
    const library = await service();
    const tracks = await library.listActive();

    expect(prisma.audioTrack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.audioUrl).toBe("https://cdn.example/audio.m4a");
  });

  it("returns nothing when the library is switched off in configuration", async () => {
    configuration.getStoryPolicy.mockResolvedValue({
      ...STORY_POLICY_DEFAULTS,
      audioLibraryEnabled: false,
    });
    const library = await service();

    await expect(library.listActive()).resolves.toEqual([]);
    expect(prisma.audioTrack.findMany).not.toHaveBeenCalled();
  });

  it("refuses catalogue management from a plain member", async () => {
    const library = await service();
    await expect(library.listAll(["MEMBER"])).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
    await expect(
      library.setActive("m1", ["MEMBER"], "track-1", false, "req"),
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
    expect(prisma.audioTrack.update).not.toHaveBeenCalled();
  });

  it("audits a moderator retiring a track", async () => {
    prisma.audioTrack.findUnique.mockResolvedValue(track());
    prisma.audioTrack.update.mockResolvedValue(track({ isActive: false }));
    const library = await service();

    const updated = await library.setActive("mod-1", ["MODERATOR"], "track-1", false, "req");

    expect(updated.isActive).toBe(false);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "AUDIO_TRACK_DISABLED", entityId: "track-1" }),
    );
  });

  it("rejects a retired track when a story tries to use it", async () => {
    prisma.audioTrack.findUnique.mockResolvedValue(track({ isActive: false }));
    const library = await service();

    await expect(library.requirePlayable("track-1")).rejects.toMatchObject({
      errorCode: "VALIDATION_ERROR",
    });
  });

  it("rejects an unknown track", async () => {
    prisma.audioTrack.findUnique.mockResolvedValue(null);
    const library = await service();

    await expect(library.requirePlayable("nope")).rejects.toMatchObject({
      errorCode: "VALIDATION_ERROR",
    });
  });
});
