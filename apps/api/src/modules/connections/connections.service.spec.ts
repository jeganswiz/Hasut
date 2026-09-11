import { Test } from "@nestjs/testing";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { NotificationWriter } from "../realtime/notification-writer";
import { RealtimeEvents } from "../realtime/realtime.events";
import { ConnectionsService } from "./connections.service";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const CONNECTION_ID = "33333333-3333-4333-8333-333333333333";

describe("ConnectionsService", () => {
  const prisma = {
    member: { findUnique: jest.fn() },
    block: { findFirst: jest.fn() },
    connection: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    conversation: { findUnique: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  const profiles = { getPreview: jest.fn() };
  const notifications = { notify: jest.fn() };
  const realtime = { publish: jest.fn() };

  async function createService(): Promise<ConnectionsService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfilesService, useValue: profiles },
        { provide: NotificationWriter, useValue: notifications },
        { provide: RealtimeEvents, useValue: realtime },
      ],
    }).compile();
    return moduleRef.get(ConnectionsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.member.findUnique.mockResolvedValue({ id: PEER, status: "ACTIVE" });
    prisma.block.findFirst.mockResolvedValue(null);
    prisma.connection.findUnique.mockResolvedValue(null);
    prisma.conversation.findUnique.mockResolvedValue(null);
    profiles.getPreview.mockImplementation(async (id: string) => ({
      id,
      displayName: id === ACTOR ? "Ada" : "Ben",
      photoUrl: null,
    }));
    notifications.notify.mockResolvedValue(null);
  });

  it("creates a pending request without exposing a phone number", async () => {
    prisma.connection.create.mockResolvedValue({
      id: CONNECTION_ID,
      requesterId: ACTOR,
      addresseeId: PEER,
      pairKey: `${ACTOR}:${PEER}`,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = await createService();
    const view = await service.request(ACTOR, PEER);
    expect(view.status).toBe("PENDING");
    expect(view.peer.displayName).toBe("Ben");
    expect(JSON.stringify(view)).not.toMatch(/phone/i);
    expect(notifications.notify).toHaveBeenCalledWith(
      PEER,
      "connection.requested",
      expect.any(Object),
    );
  });

  it("forbids a connection when either member has blocked the other", async () => {
    prisma.block.findFirst.mockResolvedValue({ id: "block-1" });
    const service = await createService();
    await expect(service.request(ACTOR, PEER)).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
    expect(prisma.connection.create).not.toHaveBeenCalled();
  });

  it("forbids the requester from accepting their own request", async () => {
    prisma.connection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      requesterId: ACTOR,
      addresseeId: PEER,
      status: "PENDING",
    });
    const service = await createService();
    await expect(service.accept(ACTOR, CONNECTION_ID)).rejects.toBeInstanceOf(HasutHttpException);
  });

  it("lets only the addressee accept and then creates a conversation", async () => {
    const pending = {
      id: CONNECTION_ID,
      requesterId: ACTOR,
      addresseeId: PEER,
      pairKey: "pair",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.connection.findUnique.mockResolvedValue(pending);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    prisma.connection.update.mockResolvedValue({ ...pending, status: "ACCEPTED" });
    prisma.conversation.upsert.mockResolvedValue({ id: "convo-1" });
    prisma.conversation.findUnique.mockResolvedValue({ id: "convo-1" });
    const service = await createService();
    const view = await service.accept(PEER, CONNECTION_ID);
    expect(view.status).toBe("ACCEPTED");
    expect(view.conversationId).toBe("convo-1");
    expect(notifications.notify).toHaveBeenCalledWith(
      ACTOR,
      "connection.accepted",
      expect.any(Object),
    );
  });

  it("forbids anyone except the addressee from rejecting", async () => {
    prisma.connection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      requesterId: ACTOR,
      addresseeId: PEER,
      status: "PENDING",
    });
    const service = await createService();
    await expect(service.reject(ACTOR, CONNECTION_ID)).rejects.toMatchObject({
      errorCode: "FORBIDDEN",
    });
  });

  it("forbids anyone except the requester from cancelling", async () => {
    prisma.connection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      requesterId: ACTOR,
      addresseeId: PEER,
      status: "PENDING",
    });
    const service = await createService();
    await expect(service.cancel(PEER, CONNECTION_ID)).rejects.toMatchObject({
      errorCode: "FORBIDDEN",
    });
  });
});
