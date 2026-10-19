import { LiveGateway } from "./live.gateway";

describe("LiveGateway", () => {
  function gateway(canWatch = true) {
    const tokens = { verifyAccess: jest.fn().mockReturnValue({ sid: "s1", sub: "m1" }) };
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: "s1",
          memberId: "m1",
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          member: { status: "ACTIVE" },
        }),
      },
      liveSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: "live-1",
          status: "LIVE",
          memberId: "host",
          audience: "EVERYONE",
        }),
      },
    };
    const live = { canWatch: jest.fn().mockResolvedValue(canWatch), recordViewerJoin: jest.fn() };
    const chat = {
      send: jest.fn().mockResolvedValue({ id: "msg" }),
      react: jest.fn(),
      pin: jest.fn(),
      hide: jest.fn(),
    };
    const viewers = {
      join: jest.fn().mockReturnValue(2),
      leave: jest.fn().mockReturnValue(1),
      isWatching: jest.fn().mockReturnValue(false),
    };
    const realtime = { subscribeRooms: jest.fn() };
    const instance = new LiveGateway(
      tokens as never,
      prisma as never,
      live as never,
      chat as never,
      viewers as never,
      realtime as never,
    );
    instance.server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as never;
    return { instance, live, chat, viewers };
  }

  it("rejects join when the viewer cannot watch", async () => {
    const { instance, viewers } = gateway(false);
    const client = { data: { memberId: "m1" }, join: jest.fn(), leave: jest.fn() };
    const result = await instance.join(client as never, { liveId: "live-1" });
    expect(result.ok).toBe(false);
    expect(viewers.join).not.toHaveBeenCalled();
  });

  it("joins the room and counts a distinct viewer", async () => {
    const { instance, viewers } = gateway(true);
    const client = { data: { memberId: "m1" }, join: jest.fn(), leave: jest.fn() };
    const result = await instance.join(client as never, { liveId: "live-1" });
    expect(result).toEqual({ ok: true, viewerCount: 2 });
    expect(viewers.join).toHaveBeenCalledWith("live-1", "m1");
  });

  it("refuses chat from a socket that has not joined", async () => {
    const { instance, chat } = gateway(true);
    const result = await instance.sendChat({ data: { memberId: "m1" } } as never, { body: "hi" });
    expect(result.ok).toBe(false);
    expect(chat.send).not.toHaveBeenCalled();
  });
});
