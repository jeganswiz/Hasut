-- CreateEnum
CREATE TYPE "StorageBackend" AS ENUM ('LOCAL', 'S3', 'B2', 'WASABI', 'R2', 'SPACES', 'MINIO');

-- CreateEnum
CREATE TYPE "StorageMigrationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StorageMigrationItemStatus" AS ENUM ('PENDING', 'COPIED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "storage_profiles" (
    "id" UUID NOT NULL,
    "provider" "StorageBackend" NOT NULL,
    "label" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "bucket" TEXT NOT NULL,
    "access_key_enc" TEXT NOT NULL DEFAULT '',
    "secret_key_enc" TEXT NOT NULL DEFAULT '',
    "force_path_style" BOOLEAN NOT NULL DEFAULT false,
    "public_base_url" TEXT NOT NULL DEFAULT '',
    "local_root" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "storage_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_migrations" (
    "id" UUID NOT NULL,
    "from_profile_id" UUID NOT NULL,
    "to_profile_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "status" "StorageMigrationStatus" NOT NULL DEFAULT 'RUNNING',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "copied_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT NOT NULL DEFAULT '',
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "storage_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_migration_items" (
    "id" UUID NOT NULL,
    "migration_id" UUID NOT NULL,
    "media_asset_id" UUID,
    "object_key" TEXT NOT NULL,
    "status" "StorageMigrationItemStatus" NOT NULL DEFAULT 'PENDING',
    "byte_size" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "storage_migration_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN "storage_profile_id" UUID;

-- CreateIndex
CREATE INDEX "storage_profiles_is_active_idx" ON "storage_profiles"("is_active");

-- CreateIndex
CREATE INDEX "storage_migrations_status_created_at_idx" ON "storage_migrations"("status", "created_at");

-- CreateIndex
CREATE INDEX "storage_migration_items_migration_id_status_idx" ON "storage_migration_items"("migration_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "storage_migration_items_migration_id_object_key_key" ON "storage_migration_items"("migration_id", "object_key");

-- CreateIndex
CREATE INDEX "media_assets_storage_profile_id_idx" ON "media_assets"("storage_profile_id");

-- CreateIndex
CREATE INDEX "media_assets_object_key_idx" ON "media_assets"("object_key");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_storage_profile_id_fkey" FOREIGN KEY ("storage_profile_id") REFERENCES "storage_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_migrations" ADD CONSTRAINT "storage_migrations_from_profile_id_fkey" FOREIGN KEY ("from_profile_id") REFERENCES "storage_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_migrations" ADD CONSTRAINT "storage_migrations_to_profile_id_fkey" FOREIGN KEY ("to_profile_id") REFERENCES "storage_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_migrations" ADD CONSTRAINT "storage_migrations_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_migration_items" ADD CONSTRAINT "storage_migration_items_migration_id_fkey" FOREIGN KEY ("migration_id") REFERENCES "storage_migrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
