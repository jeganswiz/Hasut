CREATE TABLE "live_chat_messages" (
  "id" UUID NOT NULL,
  "live_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "hidden_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "live_chat_messages_live_id_created_at_idx"
  ON "live_chat_messages"("live_id", "created_at");

ALTER TABLE "live_chat_messages"
  ADD CONSTRAINT "live_chat_messages_live_id_fkey"
  FOREIGN KEY ("live_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
