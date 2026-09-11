-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "ReviewSubjectType" AS ENUM ('MEMBER', 'PROFESSIONAL', 'BUSINESS');

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "owner_member_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "hours_json" JSONB NOT NULL DEFAULT '{}',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "cover_media_id" UUID,
    "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_categories" (
    "business_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "business_categories_pkey" PRIMARY KEY ("business_id", "category_id")
);

-- CreateTable
CREATE TABLE "business_locations" (
    "business_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_locations_pkey" PRIMARY KEY ("business_id")
);

ALTER TABLE "business_locations" ADD COLUMN "geog" geography(Point, 4326);

-- CreateTable
CREATE TABLE "review_aggregates" (
    "subject_type" "ReviewSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "avg_rating" DOUBLE PRECISION NOT NULL,
    "count" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "review_aggregates_pkey" PRIMARY KEY ("subject_type", "subject_id")
);

-- CreateIndex
CREATE INDEX "businesses_owner_member_id_status_idx" ON "businesses"("owner_member_id", "status");

-- CreateIndex
CREATE INDEX "business_locations_geog_gix" ON "business_locations" USING GIST ("geog");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_categories" ADD CONSTRAINT "business_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_categories" ADD CONSTRAINT "business_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_locations" ADD CONSTRAINT "business_locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
