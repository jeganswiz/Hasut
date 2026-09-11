-- CreateEnum
CREATE TYPE "LocationPermission" AS ENUM ('PROMPT', 'GRANTED', 'DENIED');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('AVATAR', 'PORTFOLIO', 'CHAT', 'BUSINESS', 'VERIFICATION', 'THEME_LOGO');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'REJECTED');

-- CreateTable
CREATE TABLE "current_modes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "current_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "owner_member_id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "purpose" "MediaPurpose" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "checksum" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "member_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "photo_media_id" UUID,
    "current_mode_id" UUID,
    "status_text" TEXT NOT NULL DEFAULT '',
    "is_discoverable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "member_locations" (
    "member_id" UUID NOT NULL,
    "accuracy_meters" DOUBLE PRECISION,
    "permission" "LocationPermission" NOT NULL DEFAULT 'PROMPT',
    "locality_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "member_locations_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "member_public_locations" (
    "member_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "cell_id" TEXT NOT NULL,
    "locality_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "member_public_locations_pkey" PRIMARY KEY ("member_id")
);

-- PostGIS exact + snapped points (not modeled in Prisma)
ALTER TABLE "member_locations" ADD COLUMN "geog" geography(Point, 4326);
ALTER TABLE "member_public_locations" ADD COLUMN "approx_geog" geography(Point, 4326);

-- CreateIndex
CREATE UNIQUE INDEX "current_modes_code_key" ON "current_modes"("code");

-- CreateIndex
CREATE INDEX "media_assets_owner_member_id_purpose_status_idx" ON "media_assets"("owner_member_id", "purpose", "status");

-- CreateIndex
CREATE INDEX "member_locations_geog_gix" ON "member_locations" USING GIST ("geog");

-- CreateIndex
CREATE INDEX "member_public_locations_approx_geog_gix" ON "member_public_locations" USING GIST ("approx_geog");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_photo_media_id_fkey" FOREIGN KEY ("photo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_current_mode_id_fkey" FOREIGN KEY ("current_mode_id") REFERENCES "current_modes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_locations" ADD CONSTRAINT "member_locations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_public_locations" ADD CONSTRAINT "member_public_locations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
