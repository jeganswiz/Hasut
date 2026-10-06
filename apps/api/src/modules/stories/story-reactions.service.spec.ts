import { Test } from "@nestjs/testing";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { ConnectionsService } from "../connections/connections.service";
import { MessagingService } from "../messaging/messaging.service";
import { ProfilesService } from "../profiles/profiles.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationWriter } from "../realtime/notification-writer";
import { PatronsService } from "./patrons.service";
import { StoriesService } from "./stories.service";
import { StoryReactionsService } from "./story-reactions.service";

const STORY_ID = "11111111-1111-4111-8111-111111111111";

function sqlText(call: unknown): string {
  const parts = (call as [TemplateStringsArray])[0];
  return parts.join(" ");
}

describe("StoryReactionsService", () => {
  const prisma = {
    story: { findUnique: jest.fn() },
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  };
  const stories = { assertEnabled: jest.fn() };
  const patrons = { isPatronOf: jest.fn() };
  const connections = { getWith: jest.fn() };
  const messaging = { send: jest.fn() };
  const profiles = { getPreview: jest.fn() };
  const notifications = { notify: jest.fn() };

  const active = {
    id: STORY_ID,
    memberId: "owner",
    audience: "EVERYONE",
    moderationStatus: "ACTIVE",
    expiresAt: new Date(Date.now() + 60_000),
  };

  async function service(): Promise<StoryReactionsService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StoryReactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StoriesService, useValue: stories },
        { provide: PatronsService, useValue: patrons },
        { provide: ConnectionsService, useValue: connections },
        { provide: MessagingService, useValue: messaging },
        { provide: ProfilesService, useValue: profiles },
        { provide: NotificationWriter, useValue: notifications },
      ],
    }).compile();
    return moduleRef.get(StoryReactionsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    stories.assertEnabled.mockResolvedValue(undefined);
    prisma.story.findUnique.mockResolvedValue(active);
    profiles.getPreview.mockImplementation(async (memberId: string) => ({
      id: memberId,
      displayName: memberId,
      photoUrl: null,
    }));
  });

  it("does not record the owner as a viewer", async () => {
    const reactions = await service();
    await expect(reactions.recordView("owner", STORY_ID)).resolves.toEqual({ recorded: false });
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("records another member once", async () => {
    const reactions = await service();
    await expect(reactions.recordView("ada", STORY_ID)).resolves.toEqual({ recorded: true });
    expect(sqlText(prisma.$executeRaw.mock.calls[0])).toContain("story_viewers");
  });

  it("likes, notifies the owner, and then removes the like", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ member_id: "ada" }]);
    const reactions = await service();
    await expect(reactions.toggleLike("ada", STORY_ID)).resolves.toEqual({ liked: true });
    expect(notifications.notify).toHaveBeenCalledWith(
      "owner",
      "story.liked",
      expect.objectContaining({ actorId: "ada", storyId: STORY_ID }),
    );
    await expect(reactions.toggleLike("ada", STORY_ID)).resolves.toEqual({ liked: false });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(sqlText(prisma.$executeRaw.mock.calls[1])).toContain("DELETE FROM story_likes");
  });

  it("refuses a like from the owner", async () => {
    const reactions = await service();
    await expect(reactions.toggleLike("owner", STORY_ID)).rejects.toBeInstanceOf(
      HasutHttpException,
    );
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("lists viewers for the owner and marks who liked", async () => {
    prisma.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) => {
      const sql = parts.join(" ");
      if (sql.includes("story_viewers")) {
        return [
          { member_id: "ada", viewed_at: new Date("2026-10-07T00:00:00.000Z") },
          { member_id: "bea", viewed_at: new Date("2026-10-07T00:01:00.000Z") },
        ];
      }
      return [{ member_id: "bea", created_at: new Date("2026-10-07T00:02:00.000Z") }];
    });
    const reactions = await service();
    const list = await reactions.listViewers("owner", STORY_ID);
    expect(list.viewers.map((row) => [row.member.id, row.liked])).toEqual([
      ["bea", true],
      ["ada", false],
    ]);
  });

  it("hides the viewer list from anyone else", async () => {
    const reactions = await service();
    await expect(reactions.listViewers("ada", STORY_ID)).rejects.toBeInstanceOf(HasutHttpException);
  });

  it("sends a reply only through an accepted conversation", async () => {
    connections.getWith.mockResolvedValue({
      connection: { status: "ACCEPTED", conversationId: "convo-1" },
    });
    const reactions = await service();
    await expect(reactions.reply("ada", STORY_ID, "Nice light")).resolves.toEqual({ sent: true });
    expect(messaging.send).toHaveBeenCalledWith("ada", "convo-1", {
      type: "TEXT",
      body: "Nice light",
    });
  });

  it("shares only with accepted connections", async () => {
    connections.getWith.mockImplementation(async (_actor: string, peerId: string) =>
      peerId === "bea"
        ? { connection: { status: "ACCEPTED", conversationId: "convo-bea" } }
        : { connection: { status: "PENDING", conversationId: null } },
    );
    const reactions = await service();
    await expect(reactions.share("ada", STORY_ID, ["bea", "cy"])).resolves.toEqual({ sent: 1 });
    expect(messaging.send).toHaveBeenCalledTimes(1);
    expect(messaging.send).toHaveBeenCalledWith(
      "ada",
      "convo-bea",
      expect.objectContaining({ type: "TEXT", body: `Watch this presence: /stories/owner` }),
    );
  });
});
