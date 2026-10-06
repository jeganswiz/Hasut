import type { StoryAudience, StoryViewerList } from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Story } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { ConnectionsService } from "../connections/connections.service";
import { MessagingService } from "../messaging/messaging.service";
import { ProfilesService } from "../profiles/profiles.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationWriter } from "../realtime/notification-writer";
import { PatronsService } from "./patrons.service";
import { StoriesService } from "./stories.service";

const SHARE_LIMIT = 20;

@Injectable()
export class StoryReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stories: StoriesService,
    private readonly patrons: PatronsService,
    private readonly connections: ConnectionsService,
    private readonly messaging: MessagingService,
    private readonly profiles: ProfilesService,
    private readonly notifications: NotificationWriter,
  ) {}

  /** Records that this member opened the story. The owner is not a viewer. */
  async recordView(viewerId: string, storyId: string): Promise<{ recorded: boolean }> {
    const story = await this.requireVisible(viewerId, storyId);
    if (story.memberId === viewerId) {
      return { recorded: false };
    }
    await this.prisma.$executeRaw`
      INSERT INTO story_viewers (story_id, member_id, viewed_at)
      VALUES (${storyId}::uuid, ${viewerId}::uuid, NOW())
      ON CONFLICT (story_id, member_id) DO NOTHING
    `;
    return { recorded: true };
  }

  async toggleLike(memberId: string, storyId: string): Promise<{ liked: boolean }> {
    const story = await this.requireVisible(memberId, storyId);
    if (story.memberId === memberId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "You can't like your own presence",
        HttpStatus.BAD_REQUEST,
      );
    }
    const existing = await this.findLike(storyId, memberId);
    if (existing) {
      await this.prisma.$executeRaw`
        DELETE FROM story_likes
        WHERE story_id = ${storyId}::uuid AND member_id = ${memberId}::uuid
      `;
      return { liked: false };
    }
    await this.prisma.$executeRaw`
      INSERT INTO story_likes (story_id, member_id, created_at)
      VALUES (${storyId}::uuid, ${memberId}::uuid, NOW())
    `;
    const actor = await this.profiles.getPreview(memberId);
    await this.notifications.notify(story.memberId, "story.liked", {
      actorName: actor.displayName,
      actorId: memberId,
      storyId,
    });
    return { liked: true };
  }

  async likeState(memberId: string, storyId: string): Promise<{ liked: boolean }> {
    await this.requireVisible(memberId, storyId);
    return { liked: await this.findLike(storyId, memberId) };
  }

  /** Owner-only. Likes sort first, and each liked viewer carries the heart flag. */
  async listViewers(ownerId: string, storyId: string): Promise<StoryViewerList> {
    const story = await this.requireVisible(ownerId, storyId);
    if (story.memberId !== ownerId) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "Only the story owner can see who viewed it",
        HttpStatus.FORBIDDEN,
      );
    }
    const [views, likes] = await Promise.all([
      this.prisma.$queryRaw<Array<{ member_id: string; viewed_at: Date }>>`
        SELECT member_id, viewed_at
        FROM story_viewers
        WHERE story_id = ${storyId}::uuid
        ORDER BY viewed_at DESC
      `,
      this.prisma.$queryRaw<Array<{ member_id: string; created_at: Date }>>`
        SELECT member_id, created_at
        FROM story_likes
        WHERE story_id = ${storyId}::uuid
      `,
    ]);
    const likedIds = new Set(likes.map((row) => row.member_id));
    const viewedAt = new Map(
      views.map((row) => [row.member_id, new Date(row.viewed_at).toISOString()]),
    );
    for (const like of likes) {
      if (!viewedAt.has(like.member_id)) {
        viewedAt.set(like.member_id, new Date(like.created_at).toISOString());
      }
    }
    const viewers = await Promise.all(
      [...viewedAt.entries()].map(async ([memberId, at]) => ({
        member: await this.profiles.getPreview(memberId),
        liked: likedIds.has(memberId),
        viewedAt: at,
      })),
    );
    viewers.sort((left, right) => Number(right.liked) - Number(left.liked));
    return { viewers };
  }

  async reply(memberId: string, storyId: string, text: string): Promise<{ sent: true }> {
    const story = await this.requireVisible(memberId, storyId);
    if (story.memberId === memberId) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Reply from the viewer's story, not your own",
        HttpStatus.BAD_REQUEST,
      );
    }
    const conversationId = await this.acceptedConversation(memberId, story.memberId);
    await this.messaging.send(memberId, conversationId, { type: "TEXT", body: text.trim() });
    return { sent: true };
  }

  async share(
    memberId: string,
    storyId: string,
    recipientIds: string[],
  ): Promise<{ sent: number }> {
    const story = await this.requireVisible(memberId, storyId);
    const recipients = [...new Set(recipientIds)]
      .filter((id) => id !== memberId)
      .slice(0, SHARE_LIMIT);
    if (recipients.length === 0) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Choose someone to share this presence with",
        HttpStatus.BAD_REQUEST,
      );
    }
    const body = `Watch this presence: /stories/${story.memberId}`;
    let sent = 0;
    for (const recipientId of recipients) {
      const conversationId = await this.acceptedConversation(memberId, recipientId).catch(
        () => null,
      );
      if (conversationId === null) {
        continue;
      }
      await this.messaging.send(memberId, conversationId, { type: "TEXT", body });
      sent += 1;
    }
    if (sent === 0) {
      throw new HasutHttpException(
        "NOT_CONNECTED",
        "Share a presence with an accepted connection",
        HttpStatus.FORBIDDEN,
      );
    }
    return { sent };
  }

  private async findLike(storyId: string, memberId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ member_id: string }>>`
      SELECT member_id
      FROM story_likes
      WHERE story_id = ${storyId}::uuid AND member_id = ${memberId}::uuid
      LIMIT 1
    `;
    return rows.length > 0;
  }

  private async acceptedConversation(memberId: string, peerId: string): Promise<string> {
    const lookup = await this.connections.getWith(memberId, peerId);
    const connection = lookup.connection;
    if (
      connection === null ||
      connection.status !== "ACCEPTED" ||
      connection.conversationId === null
    ) {
      throw new HasutHttpException(
        "NOT_CONNECTED",
        "You can only message accepted connections",
        HttpStatus.FORBIDDEN,
      );
    }
    return connection.conversationId;
  }

  private async requireVisible(viewerId: string, storyId: string): Promise<Story> {
    await this.stories.assertEnabled();
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (story === null || story.moderationStatus !== "ACTIVE" || story.expiresAt <= new Date()) {
      throw new HasutHttpException(
        "NOT_FOUND",
        "That story is no longer active",
        HttpStatus.NOT_FOUND,
      );
    }
    if (story.memberId === viewerId) {
      return story;
    }
    const audience = story.audience as StoryAudience;
    if (audience === "PATRONS" && !(await this.patrons.isPatronOf(story.memberId, viewerId))) {
      throw new HasutHttpException(
        "NOT_FOUND",
        "That story is no longer active",
        HttpStatus.NOT_FOUND,
      );
    }
    return story;
  }
}
