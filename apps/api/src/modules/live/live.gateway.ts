import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { LIVE_REALTIME_NAMESPACE } from "@hasut/types";
import type { Server, Socket } from "socket.io";
import { TokenService } from "../auth/token.service";
import { PrismaService } from "../prisma/prisma.service";
import { LiveViewerRegistry } from "../realtime/live-viewer-registry";
import { RealtimeEvents } from "../realtime/realtime.events";
import { LiveService } from "../stories/live.service";
import { LiveChatService } from "./live-chat.service";

@WebSocketGateway({
  namespace: LIVE_REALTIME_NAMESPACE,
  cors: { origin: true, credentials: true },
  pingInterval: 20_000,
  pingTimeout: 20_000,
})
export class LiveGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(LiveGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly live: LiveService,
    private readonly chat: LiveChatService,
    private readonly viewers: LiveViewerRegistry,
    private readonly realtime: RealtimeEvents,
  ) {}

  afterInit(): void {
    this.realtime.subscribeRooms((event) => {
      this.server.to(event.room).emit(event.event, event.payload);
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
      client.emit("ready", { memberId: session.memberId, reconnect: true });
    } catch {
      this.logger.debug("Rejected an unauthenticated live websocket");
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const memberId = client.data.memberId as string | undefined;
    const liveId = client.data.liveId as string | undefined;
    if (memberId === undefined || liveId === undefined) {
      return;
    }
    const count = this.viewers.leave(liveId, memberId);
    this.server.to(liveRoom(liveId)).emit("viewers.updated", { liveId, viewerCount: count });
  }

  @SubscribeMessage("join")
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { liveId?: string },
  ): Promise<{ ok: boolean; viewerCount: number }> {
    const memberId = client.data.memberId as string | undefined;
    const liveId = body.liveId;
    if (memberId === undefined || liveId === undefined) {
      return { ok: false, viewerCount: 0 };
    }
    const row = await this.prisma.liveSession.findUnique({ where: { id: liveId } });
    if (row === null || row.status !== "LIVE" || !(await this.live.canWatch(row, memberId))) {
      return { ok: false, viewerCount: 0 };
    }
    const previous = client.data.liveId as string | undefined;
    if (previous !== undefined && previous !== liveId) {
      await client.leave(liveRoom(previous));
      const previousCount = this.viewers.leave(previous, memberId);
      this.server.to(liveRoom(previous)).emit("viewers.updated", {
        liveId: previous,
        viewerCount: previousCount,
      });
    }
    await client.join(liveRoom(liveId));
    client.data.liveId = liveId;
    const firstJoin = !this.viewers.isWatching(liveId, memberId);
    const count = this.viewers.join(liveId, memberId);
    if (firstJoin) {
      await this.live.recordViewerJoin(liveId, count);
    }
    this.server.to(liveRoom(liveId)).emit("viewers.updated", { liveId, viewerCount: count });
    return { ok: true, viewerCount: count };
  }

  @SubscribeMessage("chat.send")
  async sendChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { body?: string },
  ): Promise<{ ok: boolean }> {
    const memberId = client.data.memberId as string | undefined;
    const liveId = client.data.liveId as string | undefined;
    if (memberId === undefined || liveId === undefined || typeof body.body !== "string") {
      return { ok: false };
    }
    const message = await this.chat.send(liveId, memberId, body.body);
    this.server.to(liveRoom(liveId)).emit("chat.message", message);
    return { ok: true };
  }

  @SubscribeMessage("reaction")
  async react(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { emoji?: string },
  ): Promise<{ ok: boolean }> {
    const memberId = client.data.memberId as string | undefined;
    const liveId = client.data.liveId as string | undefined;
    if (memberId === undefined || liveId === undefined || typeof body.emoji !== "string") {
      return { ok: false };
    }
    await this.chat.react(liveId, memberId, body.emoji);
    this.server.to(liveRoom(liveId)).emit("reaction", { liveId, emoji: body.emoji });
    return { ok: true };
  }

  @SubscribeMessage("chat.pin")
  async pin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageId?: string | null },
  ): Promise<{ ok: boolean }> {
    const memberId = client.data.memberId as string | undefined;
    const liveId = client.data.liveId as string | undefined;
    if (memberId === undefined || liveId === undefined) {
      return { ok: false };
    }
    const pinned = await this.chat.pin(liveId, memberId, body.messageId ?? null);
    this.server.to(liveRoom(liveId)).emit("chat.pinned", pinned);
    return { ok: true };
  }

  @SubscribeMessage("chat.hide")
  async hide(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageId?: string },
  ): Promise<{ ok: boolean }> {
    const memberId = client.data.memberId as string | undefined;
    const liveId = client.data.liveId as string | undefined;
    if (memberId === undefined || liveId === undefined || typeof body.messageId !== "string") {
      return { ok: false };
    }
    await this.chat.hide(liveId, memberId, body.messageId);
    this.server.to(liveRoom(liveId)).emit("chat.hidden", { messageId: body.messageId });
    return { ok: true };
  }

  emitEnded(liveId: string, endedReason: string): void {
    this.server.to(liveRoom(liveId)).emit("live.ended", { liveId, endedReason });
  }
}

export function liveRoom(liveId: string): string {
  return `live:${liveId}`;
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
