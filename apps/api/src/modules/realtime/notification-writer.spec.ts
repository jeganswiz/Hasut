import { Prisma } from "@prisma/client";
import { inQuietHours, NotificationWriter } from "./notification-writer";

describe("NotificationWriter", () => {
  function writer(prisma: Record<string, unknown>) {
    return new NotificationWriter(
      prisma as never,
      { publish: jest.fn() } as never,
      { send: jest.fn().mockResolvedValue(undefined) } as never,
    );
  }

  it("ignores a repeated notify with the same dedupe key", async () => {
    const prisma = {
      notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
      notificationSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      notificationTemplate: {
        findUnique: jest.fn().mockResolvedValue({
          key: "live.started",
          isActive: true,
          titleTemplate: "{{actorName}} is live",
          bodyTemplate: "{{title}}",
        }),
      },
      notification: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("dup", {
            code: "P2002",
            clientVersion: "test",
          }),
        ),
        count: jest.fn(),
      },
    };
    const result = await writer(prisma).notify(
      "m1",
      "live.started",
      { actorName: "Ada", title: "Shop" },
      {
        dedupeKey: "live.started:live-1:m1",
      },
    );
    expect(result).toBeNull();
  });

  it("suppresses delivery during quiet hours", async () => {
    const prisma = {
      notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
      notificationSettings: {
        findUnique: jest.fn().mockResolvedValue({
          quietHoursStartMinutes: 0,
          quietHoursEndMinutes: 1439,
          maxPerHour: 20,
        }),
      },
      notificationTemplate: { findUnique: jest.fn() },
      notification: { create: jest.fn(), count: jest.fn() },
    };
    const result = await writer(prisma).notify("m1", "live.started", {
      actorName: "Ada",
      title: "Shop",
    });
    expect(result).toBeNull();
    expect(prisma.notificationTemplate.findUnique).not.toHaveBeenCalled();
  });
});

describe("inQuietHours", () => {
  it("handles overnight windows", () => {
    expect(inQuietHours(new Date("2026-10-12T22:00:00.000Z"), 21 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(new Date("2026-10-12T08:00:00.000Z"), 21 * 60, 7 * 60)).toBe(false);
  });
});
