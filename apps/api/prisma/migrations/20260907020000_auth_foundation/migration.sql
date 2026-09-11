-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "MemberRoleName" AS ENUM ('MEMBER', 'ADMIN', 'SUPPORT_AGENT', 'MODERATOR');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'REAUTH');

-- CreateEnum
CREATE TYPE "ThemeConfigStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_roles" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "role" "MemberRoleName" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "last_sent_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "ip" TEXT,
    "device_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "device_id" TEXT,
    "refresh_token_hash" TEXT NOT NULL,
    "token_family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "ip" TEXT,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip" TEXT,
    "request_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remote_configs" (
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'all',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "remote_configs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "rules_json" JSONB,
    "description" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "theme_configs" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ThemeConfigStatus" NOT NULL,
    "tokens_json" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "theme_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_ranking_weights" (
    "id" UUID NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "category_relevance" DOUBLE PRECISION NOT NULL,
    "availability" DOUBLE PRECISION NOT NULL,
    "verification" DOUBLE PRECISION NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "activity" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "discovery_ranking_weights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "members_phone_e164_key" ON "members"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "member_roles_member_id_role_key" ON "member_roles"("member_id", "role");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_e164_purpose_consumed_at_idx" ON "otp_challenges"("phone_e164", "purpose", "consumed_at");

-- CreateIndex
CREATE INDEX "sessions_member_id_revoked_at_idx" ON "sessions"("member_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_token_family_id_idx" ON "sessions"("token_family_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "theme_configs_status_version_idx" ON "theme_configs"("status", "version");

-- AddForeignKey
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
