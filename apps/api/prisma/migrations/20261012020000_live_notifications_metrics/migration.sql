-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- AlterTable
ALTER TABLE "live_sessions" ADD COLUMN "reminder_sent_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "live_reminders" (
    "creator_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_reminders_pkey" PRIMARY KEY ("creator_id","member_id")
);

-- CreateIndex
CREATE INDEX "live_reminders_member_id_idx" ON "live_reminders"("member_id");

-- AddForeignKey
ALTER TABLE "live_reminders" ADD CONSTRAINT "live_reminders_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_reminders" ADD CONSTRAINT "live_reminders_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_member_id_endpoint_key" ON "push_subscriptions"("member_id", "endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_member_id_idx" ON "push_subscriptions"("member_id");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "notification_settings" (
    "member_id" UUID NOT NULL,
    "quiet_hours_start_minutes" INTEGER,
    "quiet_hours_end_minutes" INTEGER,
    "max_per_hour" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("member_id")
);

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "live_metric_samples" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "live_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "startup_ms" INTEGER,
    "fatal_errors" INTEGER NOT NULL DEFAULT 0,
    "reconnects" INTEGER NOT NULL DEFAULT 0,
    "dropped_frames" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_metric_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "live_metric_samples_live_id_created_at_idx" ON "live_metric_samples"("live_id", "created_at");

-- AddForeignKey
ALTER TABLE "live_metric_samples" ADD CONSTRAINT "live_metric_samples_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
