-- Optional public display name (2026-10-20), shown with the @username.
-- Additive only.
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;
