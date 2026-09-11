import { MESSAGING_POLICY_DEFAULTS } from "@hasut/config";
import { Test } from "@nestjs/testing";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { ConfigurationService } from "../configuration/configuration.service";
import { ConnectionsService } from "../connections/connections.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { NotificationWriter } from "../realtime/notification-writer";
import { RealtimeEvents } from "../realtime/realtime.events";
import { ReportsService } from "../reports/reports.service";
import { MessagingService } from "./messaging.service";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const CONVO = "44444444-4444-4444-8444-444444444444";

describe("MessagingService", () => {
  const prisma = {
    conversation: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    messageRead: { createMany: jest.fn() },
    conversationParticipant: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const connections = { requireAcceptedPair: jest.fn() };
  const reports = { assertNotBlocked: jest.fn() };
  const media = { requireReadyChatImage: jest.fn(), photoUrl: jest.fn() };
  const profiles = { getPreview: jest.fn() };
  const configuration = { getMessagingPolicy: jest.fn() };
  const notifications = { notify: jest.fn() };
  const realtime = { publish: jest.fn() };

  async function createService(): Promise<MessagingService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConnectionsService, useValue: connections },
        { provide: ReportsService, useValue: reports },
        { provide: MediaService, useValue: media },
        { provide: ProfilesService, useValue: profiles },
        { provide: ConfigurationService, useValue: configuration },
        { provide: NotificationWriter, useValue: notifications },
        { provide: RealtimeEvents, useValue: realtime },
      ],
    }).compile();
    return moduleRef.get(MessagingService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    configuration.getMessagingPolicy.mockResolvedValue(MESSAGING_POLICY_DEFAULTS);
    prisma.conversation.findUnique.mockResolvedValue({
      id: CONVO,
      participants: [{ memberId: ACTOR }, { memberId: PEER }],
      connection: { status: "ACCEPTED" },
    });
    reports.assertNotBlocked.mockResolvedValue(undefined);
    connections.requireAcceptedPair.mockResolvedValue({ status: "ACCEPTED" });
    media.photoUrl.mockResolvedValue(null);
    profiles.getPreview.mockResolvedValue({ id: ACTOR, displayName: "Ada", photoUrl: null });
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
  });

  it("sends a text message to an accepted connection without phone fields", async () => {
    prisma.message.create.mockResolvedValue({
      id: "msg-1",
      conversationId: CONVO,
      senderId: ACTOR,
      type: "TEXT",
      body: "Hello",
      mediaId: null,
      createdAt: new Date(),
      reads: [],
    });
    const service = await createService();
    const view = await service.send(ACTOR, CONVO, { type: "TEXT", body: "Hello" });
    expect(view.body).toBe("Hello");
    expect(JSON.stringify(view)).not.toMatch(/phone/i);
    expect(realtime.publish).toHaveBeenCalledWith(
      [ACTOR, PEER],
      "message.created",
      expect.objectContaining({ body: "Hello" }),
    );
  });

  it("rejects chat when the pair is not connected", async () => {
    connections.requireAcceptedPair.mockRejectedValue(
      new HasutHttpException("NOT_CONNECTED", "You can only message accepted connections", 403),
    );
    const service = await createService();
    await expect(service.send(ACTOR, CONVO, { type: "TEXT", body: "Hi" })).rejects.toMatchObject({
      errorCode: "NOT_CONNECTED",
    });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("rejects chat when a participant is blocked", async () => {
    reports.assertNotBlocked.mockRejectedValue(
      new HasutHttpException("FORBIDDEN", "You cannot interact with this member", 403),
    );
    const service = await createService();
    await expect(service.send(ACTOR, CONVO, { type: "TEXT", body: "Hi" })).rejects.toMatchObject({
      errorCode: "FORBIDDEN",
    });
  });

  it("hides a conversation from a non-participant", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: CONVO,
      participants: [{ memberId: PEER }],
      connection: { status: "ACCEPTED" },
    });
    const service = await createService();
    await expect(service.listMessages(ACTOR, CONVO)).rejects.toMatchObject({
      errorCode: "NOT_FOUND",
    });
  });
});
