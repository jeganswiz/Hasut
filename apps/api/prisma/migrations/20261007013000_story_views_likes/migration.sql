-- Story viewers and likes. Public payloads stay name and photo only.

CREATE TABLE "story_viewers" (
    "story_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_viewers_pkey" PRIMARY KEY ("story_id","member_id")
);

CREATE TABLE "story_likes" (
    "story_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_likes_pkey" PRIMARY KEY ("story_id","member_id")
);

CREATE INDEX "story_viewers_member_id_idx" ON "story_viewers"("member_id");
CREATE INDEX "story_likes_member_id_idx" ON "story_likes"("member_id");

ALTER TABLE "story_viewers" ADD CONSTRAINT "story_viewers_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_viewers" ADD CONSTRAINT "story_viewers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_likes" ADD CONSTRAINT "story_likes_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_likes" ADD CONSTRAINT "story_likes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "notification_templates" ("id", "key", "channel", "title_template", "body_template", "is_active")
VALUES (
    gen_random_uuid(),
    'story.liked',
    'IN_APP',
    '{{actorName}} liked your presence',
    'Open your story to see who liked it',
    true
)
ON CONFLICT ("key") DO NOTHING;
