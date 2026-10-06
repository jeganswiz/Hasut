import type {
  AudioTrackView,
  LivePresenceView,
  LiveSessionView,
  StoryComposerConfig,
  StoryView,
  StoryViewerList,
} from "@hasut/types";
import {
  audioTrackUpsertSchema,
  liveStartSchema,
  storyCreateSchema,
  storyModerateSchema,
  storyReplySchema,
  storyShareSchema,
} from "@hasut/validation";
import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AudioLibraryService } from "./audio-library.service";
import { LiveService } from "./live.service";
import { StoriesService } from "./stories.service";
import { StoryReactionsService } from "./story-reactions.service";

const audioTrackActiveSchema = z.object({ isActive: z.boolean() });

@ApiTags("stories")
@Controller()
export class StoriesController {
  constructor(
    private readonly stories: StoriesService,
    private readonly reactions: StoryReactionsService,
    private readonly live: LiveService,
    private readonly audio: AudioLibraryService,
  ) {}

  @ApiBearerAuth()
  @Post("me/stories")
  @ApiOperation({ summary: "Publish a presence story" })
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
    @Body(new ZodValidationPipe(liveStartSchema)) body: z.infer<typeof liveStartSchema>,
    @Req() req: Request,
  ): Promise<LiveSessionView> {
    return this.live.start(memberId, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Get("me/live")
  @ApiOperation({ summary: "Current live session for the signed-in member" })
  async currentLive(@CurrentUser("memberId") memberId: string): Promise<LivePresenceView> {
    return { live: await this.live.current(memberId) };
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
  @Get("stories/composer")
  @ApiOperation({ summary: "Caption palette, duration caps, and Patron count" })
  composerConfig(@CurrentUser("memberId") memberId: string): Promise<StoryComposerConfig> {
    return this.stories.composerConfig(memberId);
  }

  @ApiBearerAuth()
  @Get("stories/audio")
  @ApiOperation({ summary: "HASUT cloud soundtracks a member can attach" })
  listAudio(): Promise<AudioTrackView[]> {
    return this.audio.listActive();
  }

  @ApiBearerAuth()
  @Post("stories/:storyId/seen")
  @ApiOperation({ summary: "Record that the signed-in member opened this story" })
  recordView(
    @CurrentUser("memberId") viewerId: string,
    @Param("storyId") storyId: string,
  ): Promise<{ recorded: boolean }> {
    return this.reactions.recordView(viewerId, storyId);
  }

  @ApiBearerAuth()
  @Post("stories/:storyId/like")
  @ApiOperation({ summary: "Like or unlike a story" })
  toggleLike(
    @CurrentUser("memberId") memberId: string,
    @Param("storyId") storyId: string,
  ): Promise<{ liked: boolean }> {
    return this.reactions.toggleLike(memberId, storyId);
  }

  @ApiBearerAuth()
  @Get("stories/:storyId/like")
  @ApiOperation({ summary: "Whether the signed-in member likes this story" })
  likeState(
    @CurrentUser("memberId") memberId: string,
    @Param("storyId") storyId: string,
  ): Promise<{ liked: boolean }> {
    return this.reactions.likeState(memberId, storyId);
  }

  @ApiBearerAuth()
  @Get("me/stories/:storyId/viewers")
  @ApiOperation({ summary: "Who viewed the signed-in member's story, with likes marked" })
  listViewers(
    @CurrentUser("memberId") ownerId: string,
    @Param("storyId") storyId: string,
  ): Promise<StoryViewerList> {
    return this.reactions.listViewers(ownerId, storyId);
  }

  @ApiBearerAuth()
  @Post("stories/:storyId/reply")
  @ApiOperation({ summary: "Send a message to the story owner" })
  reply(
    @CurrentUser("memberId") memberId: string,
    @Param("storyId") storyId: string,
    @Body(new ZodValidationPipe(storyReplySchema)) body: { text: string },
  ): Promise<{ sent: true }> {
    return this.reactions.reply(memberId, storyId, body.text);
  }

  @ApiBearerAuth()
  @Post("stories/:storyId/share")
  @ApiOperation({ summary: "Send this story to accepted connections" })
  share(
    @CurrentUser("memberId") memberId: string,
    @Param("storyId") storyId: string,
    @Body(new ZodValidationPipe(storyShareSchema)) body: { memberIds: string[] },
  ): Promise<{ sent: number }> {
    return this.reactions.share(memberId, storyId, body.memberIds);
  }

  @ApiBearerAuth()
  @Get("stories/:memberId/live")
  @ApiOperation({ summary: "Live session for a nearby member, filtered by audience" })
  async liveForMember(
    @CurrentUser("memberId") viewerId: string,
    @Param("memberId") ownerId: string,
  ): Promise<LivePresenceView> {
    return { live: await this.live.forViewer(ownerId, viewerId) };
  }

  @ApiBearerAuth()
  @Get("stories/:memberId")
  @ApiOperation({ summary: "Active stories for a nearby member, filtered by audience" })
  listForMember(
    @CurrentUser("memberId") viewerId: string,
    @Param("memberId") ownerId: string,
  ): Promise<StoryView[]> {
    return this.stories.listForViewer(ownerId, viewerId);
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

  @ApiBearerAuth()
  @Roles("ADMIN", "MODERATOR")
  @Get("admin/stories/audio")
  @ApiOperation({ summary: "Full soundtrack catalogue including retired tracks" })
  listAudioAdmin(@CurrentUser() user: RequestAuthContext): Promise<AudioTrackView[]> {
    return this.audio.listAll(user.roles);
  }

  @ApiBearerAuth()
  @Roles("ADMIN", "MODERATOR")
  @Post("admin/stories/audio")
  @ApiOperation({ summary: "Add a soundtrack to the HASUT cloud library" })
  createAudio(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(audioTrackUpsertSchema))
    body: z.infer<typeof audioTrackUpsertSchema>,
    @Req() req: Request,
  ): Promise<AudioTrackView> {
    return this.audio.create(user.memberId, user.roles, body, getRequestId(req));
  }

  @ApiBearerAuth()
  @Roles("ADMIN", "MODERATOR")
  @Patch("admin/stories/audio/:id")
  @ApiOperation({ summary: "Retire or restore a soundtrack" })
  setAudioActive(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") trackId: string,
    @Body(new ZodValidationPipe(audioTrackActiveSchema))
    body: z.infer<typeof audioTrackActiveSchema>,
    @Req() req: Request,
  ): Promise<AudioTrackView> {
    return this.audio.setActive(
      user.memberId,
      user.roles,
      trackId,
      body.isActive,
      getRequestId(req),
    );
  }
}
