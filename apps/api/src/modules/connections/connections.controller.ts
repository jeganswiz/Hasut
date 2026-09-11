import type { ConnectionLookup, ConnectionView } from "@hasut/types";
import { connectionCreateSchema } from "@hasut/validation";
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ConnectionsService } from "./connections.service";

type ConnectionCreate = z.infer<typeof connectionCreateSchema>;

@ApiTags("connections")
@ApiBearerAuth()
@Controller()
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get("connections")
  @ApiOperation({ summary: "Incoming, outgoing, and accepted connections" })
  list(@CurrentUser("memberId") memberId: string): Promise<ConnectionView[]> {
    return this.connections.list(memberId);
  }

  @Get("connections/with/:memberId")
  @ApiOperation({ summary: "Connection state with another member" })
  withPeer(
    @CurrentUser("memberId") memberId: string,
    @Param("memberId") peerId: string,
  ): Promise<ConnectionLookup> {
    return this.connections.getWith(memberId, peerId);
  }

  @Post("connections")
  @ApiOperation({ summary: "Request a connection" })
  request(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(connectionCreateSchema)) body: ConnectionCreate,
  ): Promise<ConnectionView> {
    return this.connections.request(memberId, body.addresseeId);
  }

  @Post("connections/:id/accept")
  @ApiOperation({ summary: "Accept a pending connection request" })
  accept(
    @CurrentUser("memberId") memberId: string,
    @Param("id") connectionId: string,
  ): Promise<ConnectionView> {
    return this.connections.accept(memberId, connectionId);
  }

  @Post("connections/:id/reject")
  @ApiOperation({ summary: "Reject a pending connection request" })
  reject(
    @CurrentUser("memberId") memberId: string,
    @Param("id") connectionId: string,
  ): Promise<ConnectionView> {
    return this.connections.reject(memberId, connectionId);
  }

  @Post("connections/:id/cancel")
  @ApiOperation({ summary: "Cancel a request you sent" })
  cancel(
    @CurrentUser("memberId") memberId: string,
    @Param("id") connectionId: string,
  ): Promise<ConnectionView> {
    return this.connections.cancel(memberId, connectionId);
  }
}
