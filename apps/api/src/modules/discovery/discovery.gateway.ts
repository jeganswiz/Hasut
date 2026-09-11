import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { DISCOVERY_REALTIME_NAMESPACE } from "@hasut/types";
import { cellNeighborhood } from "@hasut/utils";
import type { Server, Socket } from "socket.io";
import { TokenService } from "../auth/token.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { LocationsRepository } from "../locations/locations.repository";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEvents } from "../realtime/realtime.events";
import { cellRoom } from "./presence-payload";

@WebSocketGateway({
  namespace: DISCOVERY_REALTIME_NAMESPACE,
  cors: { origin: true, credentials: true },
  pingInterval: 20_000,
  pingTimeout: 20_000,
})
export class DiscoveryGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(DiscoveryGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeEvents,
    private readonly locations: LocationsRepository,
    private readonly configuration: ConfigurationService,
  ) {}

  afterInit(): void {
    this.realtime.subscribeCells((event) => {
      for (const cellId of event.cellIds) {
        this.server.to(cellRoom(cellId)).emit(event.event, event.payload);
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
      await this.syncCellRooms(client, session.memberId);
      client.emit("ready", { memberId: session.memberId, reconnect: true });
    } catch {
      this.logger.debug("Rejected an unauthenticated discovery websocket");
      client.disconnect(true);
    }
  }

  @SubscribeMessage("presence.sync")
  async syncPresence(@ConnectedSocket() client: Socket): Promise<{ ok: boolean }> {
    const memberId = client.data.memberId as string | undefined;
    if (memberId === undefined) {
      return { ok: false };
    }
    await this.syncCellRooms(client, memberId);
    return { ok: true };
  }

  private async syncCellRooms(client: Socket, memberId: string): Promise<void> {
    const previous = (client.data.cellRooms as string[] | undefined) ?? [];
    for (const room of previous) {
      await client.leave(room);
    }
    const point = await this.locations.readExactPoint(memberId);
    if (point === null) {
      client.data.cellRooms = [];
      return;
    }
    const locationPolicy = await this.configuration.getLocationPolicy();
    const discoveryPolicy = await this.configuration.getDiscoveryPolicy();
    const cellIds = cellNeighborhood(
      point,
      locationPolicy.cellSizeMeters,
      discoveryPolicy.defaultRadiusMeters,
    );
    const rooms = cellIds.map((id) => cellRoom(id));
    for (const room of rooms) {
      await client.join(room);
    }
    client.data.cellRooms = rooms;
  }
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
