import type { CurrentModeView, OwnerMemberProfile, PublicMemberProfile } from "@hasut/types";
import { modeWriteSchema, profilePatchSchema, profileWriteSchema } from "@hasut/validation";
import { Body, Controller, Get, Param, Patch, Put, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ProfilesService } from "./profiles.service";

type ProfileWriteBody = z.infer<typeof profileWriteSchema>;
type ProfilePatchBody = z.infer<typeof profilePatchSchema>;
type ModeWriteBody = z.infer<typeof modeWriteSchema>;

@ApiTags("profiles")
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Public()
  @Get("current-modes")
  @ApiOperation({ summary: "Active current-mode catalog" })
  listModes(): Promise<CurrentModeView[]> {
    return this.profiles.listCurrentModes();
  }

  @ApiBearerAuth()
  @Get("me/profile")
  @ApiOperation({ summary: "Current member profile, including completion" })
  getMine(@CurrentUser("memberId") memberId: string): Promise<OwnerMemberProfile> {
    return this.profiles.getOwnerProfile(memberId);
  }

  @ApiBearerAuth()
  @Put("me/profile")
  @ApiOperation({ summary: "Create or replace the current member profile" })
  putMine(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(profileWriteSchema)) body: ProfileWriteBody,
    @Req() req: Request,
  ): Promise<OwnerMemberProfile> {
    return this.profiles.createOrReplace(memberId, memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Patch("me/profile")
  @ApiOperation({ summary: "Partially update the current member profile" })
  patchMine(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(profilePatchSchema)) body: ProfilePatchBody,
    @Req() req: Request,
  ): Promise<OwnerMemberProfile> {
    return this.profiles.update(memberId, memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Put("me/mode")
  @ApiOperation({ summary: "Set current mode and optional status text" })
  putMode(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(modeWriteSchema)) body: ModeWriteBody,
    @Req() req: Request,
  ): Promise<OwnerMemberProfile> {
    return this.profiles.setMode(memberId, memberId, body, getRequestId(req));
  }

  @Public()
  @Get("members/:id")
  @ApiOperation({ summary: "Public member profile without phone or exact coordinates" })
  getPublic(@Param("id") memberId: string, @Req() req: Request): Promise<PublicMemberProfile> {
    const viewerId = (req as Request & { user?: { memberId?: string } }).user?.memberId ?? null;
    return this.profiles.getPublicProfile(viewerId, memberId);
  }
}
