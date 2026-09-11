import type { PublicBusiness } from "@hasut/types";
import { businessWriteSchema } from "@hasut/validation";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { BusinessesService } from "./businesses.service";

type BusinessWriteBody = z.infer<typeof businessWriteSchema>;

@ApiTags("businesses")
@Controller()
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @ApiBearerAuth()
  @Post("me/businesses")
  @ApiOperation({ summary: "Create a listed business" })
  create(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(businessWriteSchema)) body: BusinessWriteBody,
    @Req() req: Request,
  ): Promise<PublicBusiness> {
    return this.businesses.create(memberId, body, getRequestId(req));
  }

  @Public()
  @Get("businesses/:id")
  @ApiOperation({ summary: "Public business profile without owner phone or exact coordinates" })
  getPublic(@Param("id") businessId: string): Promise<PublicBusiness> {
    return this.businesses.getPublic(businessId);
  }
}
