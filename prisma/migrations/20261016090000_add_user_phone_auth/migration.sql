-- Phone + OTP sign-up replaces email verification (2026-10-16).
-- Expand-only and reversible: email becomes optional (phone accounts have
-- none), and the phone columns are added. emailVerifiedAt and
-- EmailVerificationToken are left in place, unused, for a later contract
-- migration. Hand-written rather than generated: `migrate diff` against this
-- database also wants to drop "AnimeTitle"."searchVector" (see CLAUDE.md).

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
