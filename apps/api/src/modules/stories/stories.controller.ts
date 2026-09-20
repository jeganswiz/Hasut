import type { LiveSessionView, StoryView } from "@hasut/types";
import { liveStartSchema, storyCreateSchema, storyModerateSchema } from "@hasut/validation";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { LiveService } from "./live.service";
import { StoriesService } from "./stories.service";

@ApiTags("stories")
@Controller()
export class StoriesController {
  constructor(
    private readonly stories: StoriesService,
    private readonly live: LiveService,
  ) {}

  @ApiBearerAuth()
  @Post("me/stories")
  @ApiOperation({ summary: "Publish a 24h presence story" })
  create(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(storyCreateSchema)) body: z.infer<typeof storyCreateSchema>,
    @Req() req: Request,
  ): Promise<StoryView> {
    return this.stories.create(memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Get("me/stories")
  @ApiOperation({ summary: "Current member active stories" })
  listMine(@CurrentUser("memberId") memberId: string): Promise<StoryView[]> {
    return this.stories.listMine(memberId);
  }

  @ApiBearerAuth()
  @Post("me/live")
  @ApiOperation({ summary: "Start a live presence session" })
  startLive(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(liveStartSchema)) _body: z.infer<typeof liveStartSchema>,
    @Req() req: Request,
  ): Promise<LiveSessionView> {
    return this.live.start(memberId, getRequestId(req));
  }

  @ApiBearerAuth()
  @Post("me/live/end")
  @ApiOperation({ summary: "End the current live session" })
  endLive(
    @CurrentUser("memberId") memberId: string,
    @Req() req: Request,
  ): Promise<LiveSessionView> {
    return this.live.end(memberId, getRequestId(req));
  }

  @ApiBearerAuth()
  @Get("stories/:memberId")
  @ApiOperation({ summary: "Active stories for a nearby member" })
  listForMember(@Param("memberId") memberId: string): Promise<StoryView[]> {
    return this.stories.listMine(memberId);
  }

  @ApiBearerAuth()
  @Roles("ADMIN", "MODERATOR")
  @Get("admin/stories")
  @ApiOperation({ summary: "Story moderation queue" })
  listAdmin(@CurrentUser() user: RequestAuthContext): Promise<StoryView[]> {
    return this.stories.listAdmin(user.roles);
  }

  @ApiBearerAuth()
  @Roles("ADMIN", "MODERATOR")
  @Post("admin/stories/:id/hide")
  @ApiOperation({ summary: "Hide a story from the map" })
  hide(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") storyId: string,
    @Body(new ZodValidationPipe(storyModerateSchema)) _body: z.infer<typeof storyModerateSchema>,
    @Req() req: Request,
  ): Promise<StoryView> {
    return this.stories.hide(user.memberId, user.roles, storyId, getRequestId(req));
  }

  @ApiBearerAuth()
  @Roles("ADMIN", "MODERATOR")
  @Get("admin/live")
  @ApiOperation({ summary: "Live session moderation queue" })
  listLive(@CurrentUser() user: RequestAuthContext): Promise<LiveSessionView[]> {
    return this.live.listAdmin(user.roles);
  }

  @ApiBearerAuth()
  @Roles("ADMIN", "MODERATOR")
  @Post("admin/live/:id/end")
  @ApiOperation({ summary: "End a live session from moderation" })
  endLiveAdmin(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") liveId: string,
    @Req() req: Request,
  ): Promise<LiveSessionView> {
    return this.live.endById(user.memberId, user.roles, liveId, getRequestId(req));
  }
}
