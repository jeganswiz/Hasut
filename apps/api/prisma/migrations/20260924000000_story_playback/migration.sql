-- Sprint 14: a video story is not playable until a playlist exists. Existing
-- rows already published their URLs, so they stay READY.

CREATE TYPE "StoryPlaybackStatus" AS ENUM ('PENDING', 'READY');

ALTER TABLE "stories"
  ADD COLUMN "playback_status" "StoryPlaybackStatus" NOT NULL DEFAULT 'READY';
