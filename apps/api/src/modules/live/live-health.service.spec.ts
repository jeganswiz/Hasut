import { LiveHealthService, readPathReady } from "./live-health.service";

describe("readPathReady", () => {
  it("reads a MediaMTX path document", () => {
    expect(readPathReady({ ready: true, tracks: ["H264", "Opus"], bytesReceived: 1250 })).toEqual({
      ready: true,
      tracks: ["H264", "Opus"],
      bytesReceived: 1250,
    });
  });

  it("treats a missing body as not ready", () => {
    expect(readPathReady(null)).toEqual({ ready: false, tracks: [], bytesReceived: 0 });
  });
});

describe("LiveHealthService", () => {
  const viewers = { count: jest.fn() };
  const config = { get: jest.fn() };

  function service(): LiveHealthService {
    return new LiveHealthService(config as never, viewers as never);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    viewers.count.mockReturnValue(3);
  });

  it("falls back to heartbeat age when the Control API is not configured", async () => {
    config.get.mockReturnValue("");
    const health = await service().probe({
      liveId: "live-1",
      lastHeartbeatAt: new Date(),
      idleTimeoutSeconds: 90,
    });
    expect(health.state).toBe("UNKNOWN");
    expect(health.streamReady).toBe(false);
    expect(health.viewerCount).toBe(3);
    expect(health.lastHeartbeatAt).not.toBeNull();
  });

  it("marks a silent host offline from heartbeat age", async () => {
    config.get.mockReturnValue("");
    const health = await service().probe({
      liveId: "live-1",
      lastHeartbeatAt: new Date(Date.now() - 120_000),
      idleTimeoutSeconds: 90,
    });
    expect(health.state).toBe("OFFLINE");
  });

  it("maps a ready MediaMTX path to HEALTHY", async () => {
    config.get.mockReturnValue("http://127.0.0.1:9997");
    const fetchImpl = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ready: true, tracks: ["H264"], bytesReceived: 250 }), {
        status: 200,
      }),
    );
    const health = await service().probe({
      liveId: "live-1",
      lastHeartbeatAt: new Date(),
      idleTimeoutSeconds: 90,
    });
    expect(health.state).toBe("HEALTHY");
    expect(health.streamReady).toBe(true);
    expect(health.tracks).toEqual(["H264"]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/v3/paths/get/live%2Flive-1");
    fetchImpl.mockRestore();
  });

  it("treats a missing path as WAITING", async () => {
    config.get.mockReturnValue("http://127.0.0.1:9997");
    const fetchImpl = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 404 }));
    const health = await service().probe({
      liveId: "live-1",
      lastHeartbeatAt: new Date(),
      idleTimeoutSeconds: 90,
    });
    expect(health.state).toBe("WAITING");
    fetchImpl.mockRestore();
  });
});
