import { LiveNotificationsService } from "./live-notifications.service";

describe("LiveNotificationsService", () => {
  function service(overrides?: {
    patrons?: string[];
    reminders?: Array<{ memberId: string }>;
    blocked?: boolean;
    notify?: jest.Mock;
  }) {
    const prisma = {
      liveInvite: { findMany: jest.fn().mockResolvedValue([]) },
      liveReminder: {
        findMany: jest.fn().mockResolvedValue(overrides?.reminders ?? []),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      liveSession: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    };
    const patrons = { listIdsFor: jest.fn().mockResolvedValue(overrides?.patrons ?? ["p1"]) };
    const reports = {
      isBlockedEitherWay: jest.fn().mockResolvedValue(overrides?.blocked ?? false),
    };
    const profiles = {
      getPreview: jest.fn().mockResolvedValue({ id: "host", displayName: "Ada", photoUrl: null }),
    };
    const writer = {
      notify: overrides?.notify ?? jest.fn().mockResolvedValue({ id: "n1" }),
    };
    const configuration = {
      getLivePolicy: jest.fn().mockResolvedValue({ scheduleReminderMinutes: 15 }),
    };
    return {
      prisma,
      writer,
      service: new LiveNotificationsService(
        prisma as never,
        patrons as never,
        reports as never,
        profiles as never,
        writer as never,
        configuration as never,
      ),
    };
  }

  const live = {
    id: "live-1",
    memberId: "host",
    title: "Shop",
    audience: "EVERYONE",
  };

  it("notifies Patrons once per session id", async () => {
    const notify = jest.fn().mockResolvedValue({ id: "n1" });
    const { service: fanout } = service({ notify });
    const sent = await fanout.notifyStarted(live as never);
    expect(sent).toBe(1);
    expect(notify).toHaveBeenCalledWith(
      "p1",
      "live.started",
      expect.objectContaining({ liveId: "live-1" }),
      { dedupeKey: "live.started:live-1:p1" },
    );
  });

  it("includes Remind-me subscribers on public lives and skips blocked members", async () => {
    const notify = jest.fn().mockResolvedValue({ id: "n1" });
    const { service: fanout } = service({
      patrons: [],
      reminders: [{ memberId: "fan" }],
      blocked: true,
      notify,
    });
    expect(await fanout.notifyStarted(live as never)).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("does not notify reminder subscribers for PRIVATE lives", async () => {
    const notify = jest.fn().mockResolvedValue({ id: "n1" });
    const { service: fanout } = service({
      patrons: ["p1"],
      reminders: [{ memberId: "fan" }],
      notify,
    });
    expect(await fanout.notifyStarted({ ...live, audience: "PRIVATE" } as never)).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });
});
