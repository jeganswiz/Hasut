-- CreateEnum
CREATE TYPE "CategoryAppliesTo" AS ENUM ('PROFESSIONAL', 'BUSINESS', 'SERVICE', 'ALL');

-- CreateEnum
CREATE TYPE "ProfessionalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('IDENTITY', 'BUSINESS', 'SKILL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon_media_id" UUID,
    "applies_to" "CategoryAppliesTo" NOT NULL DEFAULT 'ALL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_profiles" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "availability" TEXT NOT NULL DEFAULT '',
    "status" "ProfessionalStatus" NOT NULL DEFAULT 'DRAFT',
    "identity_verification_status" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "skill_verification_status" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_categories" (
    "professional_profile_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "professional_categories_pkey" PRIMARY KEY ("professional_profile_id", "category_id")
);

-- CreateTable
CREATE TABLE "professional_skills" (
    "id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "category_id" UUID,

    CONSTRAINT "professional_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_areas" (
    "professional_profile_id" UUID NOT NULL,
    "radius_meters" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "locality_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("professional_profile_id")
);

-- Service-area center (not modeled in Prisma)
ALTER TABLE "service_areas" ADD COLUMN "center_geog" geography(Point, 4326);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "business_id" UUID,
    "payload_json" JSONB NOT NULL,
    "reviewer_id" UUID,
    "review_note" TEXT,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_is_active_sort_order_idx" ON "categories"("parent_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_member_id_key" ON "professional_profiles"("member_id");

-- CreateIndex
CREATE INDEX "service_areas_center_geog_gix" ON "service_areas" USING GIST ("center_geog");

-- CreateIndex
CREATE INDEX "verification_requests_member_id_type_created_at_idx" ON "verification_requests"("member_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "verification_requests_status_type_idx" ON "verification_requests"("status", "type");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_icon_media_id_fkey" FOREIGN KEY ("icon_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_categories" ADD CONSTRAINT "professional_categories_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_categories" ADD CONSTRAINT "professional_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_skills" ADD CONSTRAINT "professional_skills_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_skills" ADD CONSTRAINT "professional_skills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
