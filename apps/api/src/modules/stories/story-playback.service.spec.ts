import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../audit/audit.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { StoryPlaybackService } from "./story-playback.service";
import { STORY_TRANSCODER, type StoryTranscoder } from "./story-transcoder";

const STORY_ID = "11111111-1111-4111-8111-111111111111";

describe("StoryPlaybackService", () => {
  const prisma = {
    story: { findFirst: jest.fn(), updateMany: jest.fn() },
    mediaAsset: { findUnique: jest.fn() },
    audioTrack: { findUnique: jest.fn() },
  };
  const media = {
    objectUrl: jest.fn((key: string) => `https://cdn.example/${key}`),
    readObject: jest.fn(),
    writeObject: jest.fn(),
    headObject: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn() };
  const transcoder: StoryTranscoder = {
    transcode: jest.fn(async (args: readonly string[]) => {
      const playlist = args.at(-1);
      if (playlist === undefined) {
        throw new Error("missing playlist");
      }
      await writeFile(playlist, "#EXTM3U\n");
      await writeFile(join(dirname(playlist), "seg_000.ts"), Buffer.from("segment"));
    }),
  };

  async function service(): Promise<StoryPlaybackService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StoryPlaybackService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaService, useValue: media },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: config },
        { provide: STORY_TRANSCODER, useValue: transcoder },
      ],
    }).compile();
    return moduleRef.get(StoryPlaybackService);
  }

  function pendingStory(): Record<string, unknown> {
    return {
      id: STORY_ID,
      videoMediaId: "vid-1",
      audioMediaId: null,
      audioSource: "NONE",
      audioTrackId: null,
      audioStartSeconds: 0,
      audioEndSeconds: null,
      originalAudioMode: "MUTE",
      trimStartSeconds: 2,
      trimEndSeconds: 8,
      playbackStatus: "PENDING",
      moderationStatus: "ACTIVE",
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue("ffmpeg");
    media.objectUrl.mockImplementation((key: string) => `https://cdn.example/${key}`);
    media.readObject.mockResolvedValue(Buffer.from("video"));
    media.writeObject.mockResolvedValue(undefined);
    media.headObject.mockResolvedValue({
      contentType: "application/vnd.apple.mpegurl",
      contentLength: 8,
    });
    prisma.mediaAsset.findUnique.mockResolvedValue({
      id: "vid-1",
      objectKey: "video/m1/vid-1",
      status: "READY",
    });
    prisma.story.updateMany.mockResolvedValue({ count: 1 });
    audit.record.mockResolvedValue(undefined);
  });

  it("does nothing when ffmpeg is not configured", async () => {
    config.get.mockReturnValue("");
    const playback = await service();
    await expect(playback.processNext()).resolves.toBe("idle");
    expect(prisma.story.findFirst).not.toHaveBeenCalled();
  });

  it("does nothing when stored objects are not a public URL", async () => {
    media.objectUrl.mockReturnValue("memory://story-hls/ready-check/index.m3u8");
    const playback = await service();
    await expect(playback.processNext()).resolves.toBe("idle");
    expect(prisma.story.findFirst).not.toHaveBeenCalled();
  });

  it("waits when the video upload has no bytes yet", async () => {
    prisma.story.findFirst.mockResolvedValue(pendingStory());
    media.readObject.mockResolvedValue(null);
    const playback = await service();
    await expect(playback.processNext()).resolves.toBe("waiting");
    expect(transcoder.transcode).not.toHaveBeenCalled();
    expect(prisma.story.updateMany).not.toHaveBeenCalled();
  });

  it("stores a 240p playlist and marks the story ready", async () => {
    prisma.story.findFirst.mockResolvedValue(pendingStory());
    const playback = await service();
    await expect(playback.processNext()).resolves.toBe("ready");

    const args = (transcoder.transcode as jest.Mock).mock.calls[0][0] as string[];
    expect(args).toEqual(expect.arrayContaining(["-ss", "2", "-t", "6", "-an"]));
    expect(args.join(" ")).not.toContain("caption");
    expect(prisma.story.updateMany).toHaveBeenCalledWith({
      where: { id: STORY_ID, playbackStatus: "PENDING", moderationStatus: "ACTIVE" },
      data: {
        playbackStatus: "READY",
        hlsUrl: `https://cdn.example/story-hls/${STORY_ID}/index.m3u8`,
        previewHlsUrl: `https://cdn.example/story-hls/${STORY_ID}/index.m3u8`,
      },
    });
    expect(media.writeObject).toHaveBeenCalledWith(
      `story-hls/${STORY_ID}/index.m3u8`,
      expect.any(Buffer),
      "application/vnd.apple.mpegurl",
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "STORY_PLAYBACK_READY", entityId: STORY_ID }),
    );
  });

  it("does not retry a story whose transcode failed", async () => {
    prisma.story.findFirst.mockImplementation(
      async (args: { where?: { id?: { notIn?: string[] } } }) => {
        const skipped = args.where?.id?.notIn ?? [];
        return skipped.includes(STORY_ID) ? null : pendingStory();
      },
    );
    (transcoder.transcode as jest.Mock).mockRejectedValueOnce(new Error("ffmpeg exited 1"));
    const playback = await service();
    await expect(playback.processNext()).resolves.toBe("failed");
    await expect(playback.processNext()).resolves.toBe("idle");
    expect(prisma.story.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: [STORY_ID] } }),
      }),
    );
  });
});
