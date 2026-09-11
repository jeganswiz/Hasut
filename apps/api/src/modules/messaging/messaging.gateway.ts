import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "../auth/token.service";
import { RealtimeEvents } from "../realtime/realtime.events";

@WebSocketGateway({
  namespace: "/ws/v1/messaging",
  cors: { origin: true, credentials: true },
  pingInterval: 20_000,
  pingTimeout: 20_000,
})
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEvents,
  ) {}

  afterInit(): void {
    this.realtime.subscribe((event) => {
      for (const memberId of event.memberIds) {
        this.server.to(memberRoom(memberId)).emit(event.event, event.payload);
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = readAccessToken(client);
      const claims = this.tokens.verifyAccess(token);
      const session = await this.prisma.session.findUnique({
        where: { id: claims.sid },
        include: { member: true },
      });
      if (
        session === null ||
        session.memberId !== claims.sub ||
        session.revokedAt !== null ||
        session.expiresAt.getTime() <= Date.now() ||
        session.member.status !== "ACTIVE"
      ) {
        client.disconnect(true);
        return;
      }
      client.data.memberId = session.memberId;
      await client.join(memberRoom(session.memberId));
      const conversations = await this.prisma.conversationParticipant.findMany({
        where: { memberId: session.memberId },
        select: { conversationId: true },
      });
      for (const row of conversations) {
        await client.join(conversationRoom(row.conversationId));
      }
      client.emit("ready", { memberId: session.memberId, reconnect: true });
    } catch {
      this.logger.debug("Rejected an unauthenticated websocket");
      client.disconnect(true);
    }
  }

  @SubscribeMessage("join.conversation")
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ): Promise<{ ok: boolean }> {
    const memberId = client.data.memberId as string | undefined;
    if (memberId === undefined || typeof body.conversationId !== "string") {
      return { ok: false };
    }
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_memberId: { conversationId: body.conversationId, memberId },
      },
    });
    if (participant === null) {
      return { ok: false };
    }
    await client.join(conversationRoom(body.conversationId));
    return { ok: true };
  }
}

function memberRoom(memberId: string): string {
  return `member:${memberId}`;
}

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

function readAccessToken(client: Socket): string {
  const auth = client.handshake.auth as { token?: unknown };
  if (typeof auth.token === "string" && auth.token.length > 0) {
    return auth.token.startsWith("Bearer ") ? auth.token.slice("Bearer ".length) : auth.token;
  }
  const header = client.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  throw new Error("missing token");
}
