-- Sprint 11: story composer. Adds caption, trim, and soundtrack columns that the
-- create contract already accepted but the schema could not store, plus the
-- admin-curated audio library.

CREATE TYPE "StoryAudioSource" AS ENUM ('NONE', 'LIBRARY', 'UPLOAD');
CREATE TYPE "StoryOriginalAudioMode" AS ENUM ('KEEP', 'MUTE', 'OVERLAY');

CREATE TABLE "audio_tracks" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "artist" TEXT NOT NULL,
  "media_id" UUID NOT NULL,
  "duration_seconds" INTEGER NOT NULL,
  "mood" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audio_tracks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audio_tracks_is_active_mood_idx" ON "audio_tracks" ("is_active", "mood");

ALTER TABLE "stories"
  ADD COLUMN "audio_source" "StoryAudioSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "audio_track_id" UUID,
  ADD COLUMN "audio_start_seconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "audio_end_seconds" INTEGER,
  ADD COLUMN "original_audio_mode" "StoryOriginalAudioMode" NOT NULL DEFAULT 'KEEP',
  ADD COLUMN "caption" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "caption_color" TEXT,
  ADD COLUMN "trim_start_seconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trim_end_seconds" INTEGER;

-- Stories written before this migration stored an uploaded audio media id with
-- no source marker; backfill so the column agrees with the data already there.
UPDATE "stories" SET "audio_source" = 'UPLOAD' WHERE "audio_media_id" IS NOT NULL;

ALTER TABLE "stories"
  ADD CONSTRAINT "stories_audio_track_id_fkey"
  FOREIGN KEY ("audio_track_id") REFERENCES "audio_tracks" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "live_sessions" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
