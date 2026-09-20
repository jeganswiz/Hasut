import type { AdminVerificationRequest, IdentityVerificationRequest } from "@hasut/types";
import { identityVerificationWriteSchema, verificationDecideSchema } from "@hasut/validation";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { VerificationService } from "./verification.service";

type IdentityWriteBody = z.infer<typeof identityVerificationWriteSchema>;
type DecideBody = z.infer<typeof verificationDecideSchema>;

@ApiTags("verification")
@Controller()
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @ApiBearerAuth()
  @Post("verification/identity")
  @ApiOperation({ summary: "Request identity verification" })
  requestIdentity(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(identityVerificationWriteSchema)) body: IdentityWriteBody,
    @Req() req: Request,
  ): Promise<IdentityVerificationRequest> {
    return this.verification.requestIdentity(memberId, body.documentMediaIds, getRequestId(req));
  }

  @ApiBearerAuth()
  @Get("verification/identity")
  @ApiOperation({ summary: "Latest identity verification request" })
  getIdentity(@CurrentUser("memberId") memberId: string): Promise<IdentityVerificationRequest> {
    return this.verification.getIdentity(memberId);
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Get("admin/verification")
  @ApiOperation({ summary: "Identity verification queue" })
  listQueue(@CurrentUser() user: RequestAuthContext): Promise<AdminVerificationRequest[]> {
    return this.verification.listQueue(user.roles);
  }

  @ApiBearerAuth()
  @Roles("ADMIN")
  @Post("admin/verification/:id/decide")
  @ApiOperation({ summary: "Approve or reject an identity verification request" })
  decide(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") requestIdParam: string,
    @Body(new ZodValidationPipe(verificationDecideSchema)) body: DecideBody,
    @Req() req: Request,
  ): Promise<AdminVerificationRequest> {
    return this.verification.decide(
      user.memberId,
      user.roles,
      requestIdParam,
      body,
      getRequestId(req),
    );
  }
}
