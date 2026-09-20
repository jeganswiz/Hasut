import type { ServiceOfferingView } from "@hasut/types";
import { serviceOfferingWriteSchema } from "@hasut/validation";
import { Body, Controller, Delete, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ServicesService } from "./services.service";

type ServiceWriteBody = z.infer<typeof serviceOfferingWriteSchema>;

@ApiTags("services")
@Controller()
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @ApiBearerAuth()
  @Get("me/services")
  @ApiOperation({ summary: "Current professional service offerings" })
  listMine(@CurrentUser("memberId") memberId: string): Promise<ServiceOfferingView[]> {
    return this.services.listMine(memberId);
  }

  @ApiBearerAuth()
  @Post("me/services")
  @ApiOperation({ summary: "Create a service offering without booking" })
  create(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(serviceOfferingWriteSchema)) body: ServiceWriteBody,
    @Req() req: Request,
  ): Promise<ServiceOfferingView> {
    return this.services.create(memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Delete("me/services/:id")
  @ApiOperation({ summary: "Pause a service offering" })
  remove(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") offeringId: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    return this.services
      .remove(user.memberId, offeringId, user.roles, getRequestId(req))
      .then(() => ({ ok: true }));
  }

  @Public()
  @Get("professionals/:id/services")
  @ApiOperation({ summary: "Public service offerings for a professional" })
  listPublic(@Param("id") professionalId: string): Promise<ServiceOfferingView[]> {
    return this.services.listPublic(professionalId);
  }
}
