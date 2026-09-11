-- Enable PostGIS and cryptographic helpers before any geography columns exist.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "schema_bootstrap" (
    "id" TEXT NOT NULL,
    "postgis" BOOLEAN NOT NULL,
    "seeded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_bootstrap_pkey" PRIMARY KEY ("id")
);
