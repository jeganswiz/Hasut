-- Sprint 10: email + password, OTP over email, SSO identities, two-step verification.

-- AlterEnum: one-time codes now cover recovery and the second factor.
ALTER TYPE "OtpPurpose" ADD VALUE 'PASSWORD_RESET';
ALTER TYPE "OtpPurpose" ADD VALUE 'TWO_FACTOR';

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('SMS', 'EMAIL');
CREATE TYPE "IdentityProviderName" AS ENUM ('GOOGLE', 'FACEBOOK');

-- AlterTable: credentials on the single Member identity.
ALTER TABLE "members"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "email_verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "password_hash" TEXT,
  ADD COLUMN "password_updated_at" TIMESTAMPTZ(6),
  ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Email-first and SSO members have no phone until they add one.
ALTER TABLE "members" ALTER COLUMN "phone_e164" DROP NOT NULL;

CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- AlterTable: a challenge targets a phone or an email, never both.
ALTER TABLE "otp_challenges"
  ADD COLUMN "channel" "OtpChannel" NOT NULL DEFAULT 'SMS',
  ADD COLUMN "email" TEXT,
  ADD COLUMN "member_id" UUID;

ALTER TABLE "otp_challenges" ALTER COLUMN "phone_e164" DROP NOT NULL;

CREATE INDEX "otp_challenges_email_purpose_consumed_at_idx"
  ON "otp_challenges"("email", "purpose", "consumed_at");

-- CreateTable
CREATE TABLE "member_identities" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "provider" "IdentityProviderName" NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "email" TEXT,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_identities_provider_provider_account_id_key"
  ON "member_identities"("provider", "provider_account_id");

CREATE INDEX "member_identities_member_id_idx" ON "member_identities"("member_id");

ALTER TABLE "member_identities"
  ADD CONSTRAINT "member_identities_member_id_fkey"
  FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
