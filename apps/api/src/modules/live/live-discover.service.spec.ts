import { LiveDiscoverService } from "./live-discover.service";

describe("LiveDiscoverService", () => {
  it("omits lives the viewer cannot watch and never includes coordinates", async () => {
    const liveRow = {
      id: "live-1",
      memberId: "host",
      title: "Shop",
      description: "",
      category: "Workshop",
      thumbnailMediaId: null,
      audience: "EVERYONE",
      status: "LIVE",
      scheduledFor: null,
      hlsUrl: "/media/hls/live/live-1/index.m3u8",
      previewHlsUrl: "/media/hls/live/live-1/index.m3u8",
      ingestUrl: null,
      chatEnabled: true,
      chatPatronsOnly: false,
      slowModeSeconds: 0,
      blockedWords: [],
      recordingEnabled: false,
      recordingStatus: "NONE",
      replayStoryId: null,
      lastHeartbeatAt: null,
      peakViewers: 4,
      totalViews: 4,
      reactionCount: 0,
      messageCount: 0,
      endedReason: null,
      startedAt: new Date(),
      endedAt: null,
    };
    const prisma = {
      liveSession: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([liveRow])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
    };
    const live = { canWatch: jest.fn().mockResolvedValue(true) };
    const patrons = { patronOwnersAmong: jest.fn().mockResolvedValue(new Set()) };
    const profiles = {
      getPreview: jest.fn().mockResolvedValue({ id: "host", displayName: "Ada", photoUrl: null }),
    };
    const media = { photoUrl: jest.fn().mockResolvedValue(null) };
    const viewers = { count: jest.fn().mockReturnValue(3) };
    const service = new LiveDiscoverService(
      prisma as never,
      live as never,
      patrons as never,
      profiles as never,
      media as never,
      viewers as never,
    );
    const result = await service.discover("viewer");
    expect(result.liveNow[0]?.distanceBucket).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/lat|lng|latitude|longitude/i);
    expect(result.liveNow[0]?.href).toBe("/live/live-1");
  });
});
