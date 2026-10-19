-- Live sessions grow from a presence flag into a broadcast record: settings,
-- scheduling, heartbeat, engagement counters, recording state, and a private
-- audience with invites. One LIVE row per member is enforced by the database.

ALTER TYPE "LiveSessionStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED' BEFORE 'LIVE';
ALTER TYPE "StoryAudience" ADD VALUE IF NOT EXISTS 'PRIVATE';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'LIVE';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'LIVE_CHAT_MESSAGE';

CREATE TYPE "LiveRecordingStatus" AS ENUM ('NONE', 'RECORDING', 'PROCESSING', 'READY', 'FAILED', 'DISCARDED');
CREATE TYPE "LiveEndReason" AS ENUM ('HOST', 'MODERATOR', 'IDLE_TIMEOUT');

ALTER TABLE "live_sessions"
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "category" TEXT,
  ADD COLUMN "thumbnail_media_id" UUID,
  ADD COLUMN "scheduled_for" TIMESTAMPTZ(6),
  ADD COLUMN "chat_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "chat_patrons_only" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "slow_mode_seconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "blocked_words" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "recording_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recording_status" "LiveRecordingStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "replay_story_id" UUID,
  ADD COLUMN "last_heartbeat_at" TIMESTAMPTZ(6),
  ADD COLUMN "peak_viewers" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total_views" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reaction_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "message_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ended_reason" "LiveEndReason";

CREATE INDEX "live_sessions_status_started_at_idx" ON "live_sessions"("status", "started_at");
CREATE INDEX "live_sessions_status_scheduled_for_idx" ON "live_sessions"("status", "scheduled_for");

-- Older rows may hold more than one LIVE session per member. Keep the newest.
UPDATE "live_sessions" AS older
SET "status" = 'ENDED', "ended_at" = COALESCE(older."ended_at", now())
WHERE older."status" = 'LIVE'
  AND EXISTS (
    SELECT 1 FROM "live_sessions" AS newer
    WHERE newer."member_id" = older."member_id"
      AND newer."status" = 'LIVE'
      AND newer."started_at" > older."started_at"
  );

CREATE UNIQUE INDEX "live_sessions_one_live_per_member"
  ON "live_sessions"("member_id")
  WHERE "status" = 'LIVE';

CREATE TABLE "live_invites" (
  "live_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_invites_pkey" PRIMARY KEY ("live_id", "member_id")
);
CREATE INDEX "live_invites_member_id_idx" ON "live_invites"("member_id");
ALTER TABLE "live_invites"
  ADD CONSTRAINT "live_invites_live_id_fkey"
  FOREIGN KEY ("live_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "live_moderators" (
  "host_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_moderators_pkey" PRIMARY KEY ("host_id", "member_id")
);
CREATE INDEX "live_moderators_member_id_idx" ON "live_moderators"("member_id");
