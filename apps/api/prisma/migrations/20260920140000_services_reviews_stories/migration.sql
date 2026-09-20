-- AlterEnum
ALTER TYPE "MediaPurpose" ADD VALUE 'STORY_IMAGE';
ALTER TYPE "MediaPurpose" ADD VALUE 'STORY_VIDEO';
ALTER TYPE "MediaPurpose" ADD VALUE 'STORY_AUDIO';

-- CreateEnum
CREATE TYPE "StoryKind" AS ENUM ('IMAGE', 'VIDEO', 'LIVE');
CREATE TYPE "StoryModerationStatus" AS ENUM ('ACTIVE', 'HIDDEN');
CREATE TYPE "LiveSessionStatus" AS ENUM ('LIVE', 'ENDED');

-- CreateTable
CREATE TABLE "service_offerings" (
    "id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "display_price_amount" DECIMAL(12,2),
    "display_currency" TEXT,
    "cover_media_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_offerings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "subject_type" "ReviewSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "kind" "StoryKind" NOT NULL,
    "image_media_id" UUID,
    "video_media_id" UUID,
    "audio_media_id" UUID,
    "hls_url" TEXT,
    "preview_hls_url" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "moderation_status" "StoryModerationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'LIVE',
    "hls_url" TEXT,
    "preview_hls_url" TEXT,
    "ingest_url" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_offerings_professional_profile_id_is_active_idx" ON "service_offerings"("professional_profile_id", "is_active");
CREATE UNIQUE INDEX "reviews_author_id_subject_type_subject_id_key" ON "reviews"("author_id", "subject_type", "subject_id");
CREATE INDEX "reviews_subject_type_subject_id_idx" ON "reviews"("subject_type", "subject_id");
CREATE INDEX "stories_member_id_expires_at_idx" ON "stories"("member_id", "expires_at");
CREATE INDEX "stories_moderation_status_expires_at_idx" ON "stories"("moderation_status", "expires_at");
CREATE INDEX "live_sessions_member_id_status_idx" ON "live_sessions"("member_id", "status");

ALTER TABLE "service_offerings" ADD CONSTRAINT "service_offerings_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_offerings" ADD CONSTRAINT "service_offerings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stories" ADD CONSTRAINT "stories_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
