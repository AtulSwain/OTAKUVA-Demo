-- Episode retention (2026-10-20): episodes are rated by retention % (how
-- much the episode kept you hooked), separately from the anime's own score.
-- Additive only: a new nullable column, and the old per-episode score becomes
-- optional (existing scores are kept; new retention-only rows leave it NULL).
ALTER TABLE "EpisodeRating" ADD COLUMN "retention" INTEGER;
ALTER TABLE "EpisodeRating" ALTER COLUMN "rating" DROP NOT NULL;
