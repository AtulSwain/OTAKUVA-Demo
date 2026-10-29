-- Password sign-in for every account + activity timestamps (2026-10-28).
-- Additive only. Hand-written (see CLAUDE.md: `migrate diff` here also wants
-- to drop the raw-SQL search index on AnimeTitle, which must stay).
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");
