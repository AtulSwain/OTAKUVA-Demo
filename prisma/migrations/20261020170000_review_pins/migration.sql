-- Pinned reviews (2026-10-20): moderators can pin a good review to the top
-- of an anime's reviews. Additive only.
ALTER TABLE "Review" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN "pinnedById" TEXT;
CREATE INDEX "Review_animeId_pinnedAt_idx" ON "Review"("animeId", "pinnedAt");
