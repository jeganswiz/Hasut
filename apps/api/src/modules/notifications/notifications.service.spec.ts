import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationWriter } from "../realtime/notification-writer";
import { NotificationsService } from "./notifications.service";

const MEMBER = "11111111-1111-4111-8111-111111111111";

describe("NotificationsService", () => {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    message: { count: jest.fn() },
  };
  const writer = { notify: jest.fn() };

  async function createService(): Promise<NotificationsService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationWriter, useValue: writer },
      ],
    }).compile();
    return moduleRef.get(NotificationsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns unread notification and message counts", async () => {
    prisma.notification.count.mockResolvedValue(2);
    prisma.message.count.mockResolvedValue(4);
    const service = await createService();
    await expect(service.unreadCount(MEMBER)).resolves.toEqual({
      notifications: 2,
      messages: 4,
    });
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: {
        senderId: { not: MEMBER },
        conversation: { participants: { some: { memberId: MEMBER } } },
        reads: { none: { memberId: MEMBER } },
      },
    });
  });
});
