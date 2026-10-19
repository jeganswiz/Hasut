import { LIVE_POLICY_DEFAULTS } from "@hasut/config";
import { LiveLifecycleWorker } from "./live-lifecycle.worker";

describe("LiveLifecycleWorker", () => {
  it("ends LIVE sessions whose heartbeat is older than the idle cap", async () => {
    const prisma = {
      liveSession: { findMany: jest.fn().mockResolvedValue([{ id: "stale-1" }]) },
    };
    const configuration = { getLivePolicy: jest.fn().mockResolvedValue(LIVE_POLICY_DEFAULTS) };
    const live = { endIdle: jest.fn().mockResolvedValue({ id: "stale-1" }) };
    const recording = { processNext: jest.fn().mockResolvedValue("idle") };
    const notifications = { remindUpcoming: jest.fn().mockResolvedValue(0) };
    const worker = new LiveLifecycleWorker(
      prisma as never,
      configuration as never,
      live as never,
      recording as never,
      notifications as never,
    );
    await expect(worker.tick()).resolves.toBe(1);
    expect(live.endIdle).toHaveBeenCalledWith("stale-1");
  });
});
