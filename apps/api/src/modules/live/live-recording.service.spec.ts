import { LiveRecordingService } from "./live-recording.service";

describe("LiveRecordingService", () => {
  const liveId = "11111111-1111-4111-8111-111111111111";

  function service(fetchImpl: typeof fetch) {
    const prisma = {
      liveSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: liveId,
          memberId: "host",
          title: "Shop",
          audience: "EVERYONE",
          recordingEnabled: true,
          recordingStatus: "PROCESSING",
          replayStoryId: null,
          startedAt: new Date("2026-10-12T00:00:00.000Z"),
          endedAt: new Date("2026-10-12T00:02:00.000Z"),
        }),
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      story: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      mediaAsset: { create: jest.fn().mockResolvedValue({ id: "asset-1" }) },
    };
    const config = { get: jest.fn().mockReturnValue("http://127.0.0.1:9996") };
    const configuration = {
      getLivePolicy: jest.fn().mockResolvedValue({ replayRetentionDays: 30 }),
    };
    const media = { writeObject: jest.fn().mockResolvedValue(undefined) };
    const instance = new LiveRecordingService(
      prisma as never,
      config as never,
      configuration as never,
      media as never,
    );
    return { instance, prisma, media, fetchImpl };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("marks FAILED when the playback API is missing", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) } as Response);
    const { instance, prisma } = service(fetch);
    prisma.liveSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: liveId,
      recordingEnabled: true,
      recordingStatus: "PROCESSING",
      replayStoryId: null,
      endedAt: new Date(),
    });
    expect(await instance.processNext()).toBe("failed");
    expect(prisma.liveSession.update).toHaveBeenCalledWith({
      where: { id: liveId },
      data: { recordingStatus: "FAILED" },
    });
    expect(prisma.story.create).not.toHaveBeenCalled();
  });

  it("stores a LIVE story as PENDING until ffmpeg is ready", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as Response);
    const { instance, prisma, media } = service(fetch);
    await instance.finalize(liveId);
    expect(media.writeObject).toHaveBeenCalled();
    expect(prisma.story.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: liveId,
          kind: "LIVE",
          playbackStatus: "PENDING",
        }),
      }),
    );
  });
});
