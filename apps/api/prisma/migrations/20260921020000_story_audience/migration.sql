-- Sprint 12: audience. A member can keep a story or a live to their Patrons,
-- HASUT's word for accepted connections. Existing rows were published with no
-- restriction, so EVERYONE is the only safe backfill.

CREATE TYPE "StoryAudience" AS ENUM ('EVERYONE', 'PATRONS');

ALTER TABLE "stories" ADD COLUMN "audience" "StoryAudience" NOT NULL DEFAULT 'EVERYONE';
ALTER TABLE "live_sessions" ADD COLUMN "audience" "StoryAudience" NOT NULL DEFAULT 'EVERYONE';

-- Reading a member's stories now filters on audience, and pin media joins the
-- same way, so both paths need the audience column in their index.
CREATE INDEX "stories_audience_expires_at_idx" ON "stories" ("audience", "expires_at");
