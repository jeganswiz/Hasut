import { LIVE_POLICY_DEFAULTS } from "@hasut/config";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { LiveChatService } from "./live-chat.service";

describe("LiveChatService", () => {
  const prisma = {
    liveSession: { findUnique: jest.fn() },
    liveChatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const live = {
    canWatch: jest.fn(),
    isModerator: jest.fn(),
    addMessage: jest.fn(),
    addReactions: jest.fn(),
  };
  const patrons = { isPatronOf: jest.fn() };
  const profiles = { getPreview: jest.fn() };
  const configuration = { getLivePolicy: jest.fn() };
  const redis = { incrementWithTtl: jest.fn(), get: jest.fn(), set: jest.fn() };
  const reports = { createReport: jest.fn() };

  function service(): LiveChatService {
    return new LiveChatService(
      prisma as never,
      live as never,
      patrons as never,
      profiles as never,
      configuration as never,
      redis as never,
      reports as never,
    );
  }

  const session = {
    id: "live-1",
    memberId: "host",
    audience: "EVERYONE",
    status: "LIVE",
    chatEnabled: true,
    chatPatronsOnly: false,
    slowModeSeconds: 0,
    blockedWords: ["scam"],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.liveSession.findUnique.mockResolvedValue(session);
    live.canWatch.mockResolvedValue(true);
    live.isModerator.mockResolvedValue(false);
    live.addMessage.mockResolvedValue(undefined);
    patrons.isPatronOf.mockResolvedValue(true);
    profiles.getPreview.mockResolvedValue({ id: "v1", displayName: "Ben", photoUrl: null });
    configuration.getLivePolicy.mockResolvedValue(LIVE_POLICY_DEFAULTS);
    redis.incrementWithTtl.mockResolvedValue(1);
    redis.get.mockResolvedValue(null);
  });

  it("stores a chat line and increments the session counter", async () => {
    prisma.liveChatMessage.create.mockResolvedValue({
      id: "m1",
      liveId: "live-1",
      memberId: "v1",
      body: "Hello",
      pinned: false,
      createdAt: new Date("2026-10-12T00:00:00.000Z"),
    });
    const message = await service().send("live-1", "v1", " Hello ");
    expect(message.body).toBe("Hello");
    expect(live.addMessage).toHaveBeenCalledWith("live-1");
  });

  it("refuses a blocked word from policy or the host list", async () => {
    await expect(service().send("live-1", "v1", "this is a scam")).rejects.toBeInstanceOf(
      HasutHttpException,
    );
  });

  it("refuses chat after the session ends", async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: "ENDED" });
    await expect(service().send("live-1", "v1", "hi")).rejects.toMatchObject({
      errorCode: "CONFLICT",
    });
  });

  it("lets only a moderator hide a message", async () => {
    live.isModerator.mockResolvedValue(false);
    await expect(service().hide("live-1", "v1", "m1")).rejects.toMatchObject({
      errorCode: "FORBIDDEN",
    });
    live.isModerator.mockResolvedValue(true);
    prisma.liveChatMessage.updateMany.mockResolvedValue({ count: 1 });
    await service().hide("live-1", "host", "m1");
    expect(prisma.liveChatMessage.updateMany).toHaveBeenCalled();
  });

  it("rate-limits chat from Redis", async () => {
    redis.incrementWithTtl.mockResolvedValue(LIVE_POLICY_DEFAULTS.chatMessagesPerMinute + 1);
    await expect(service().send("live-1", "v1", "hi")).rejects.toMatchObject({
      errorCode: "RATE_LIMITED",
    });
  });
});
