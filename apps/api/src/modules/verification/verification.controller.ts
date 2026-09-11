import type { IdentityVerificationRequest } from "@hasut/types";
import { identityVerificationWriteSchema } from "@hasut/validation";
import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { VerificationService } from "./verification.service";

type IdentityWriteBody = z.infer<typeof identityVerificationWriteSchema>;

@ApiTags("verification")
@Controller("verification")
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @ApiBearerAuth()
  @Post("identity")
  @ApiOperation({ summary: "Request identity verification" })
  requestIdentity(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(identityVerificationWriteSchema)) body: IdentityWriteBody,
    @Req() req: Request,
  ): Promise<IdentityVerificationRequest> {
    return this.verification.requestIdentity(memberId, body.documentMediaIds, getRequestId(req));
  }

  @ApiBearerAuth()
  @Get("identity")
  @ApiOperation({ summary: "Latest identity verification request" })
  getIdentity(@CurrentUser("memberId") memberId: string): Promise<IdentityVerificationRequest> {
    return this.verification.getIdentity(memberId);
  }
}
