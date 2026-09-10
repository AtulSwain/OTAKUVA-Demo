-- Anime-relevance gate for NewsArticle.
--
-- Expand-only: three ADD COLUMN statements plus one index. SQLite applies
-- these in place, so no table rebuild and no row copy — existing articles keep
-- their ids, relations and cluster links untouched.
--
-- Every existing row defaults to 'ANIME_RELATED' so nothing disappears from the
-- feed on deploy. Reclassification is a separate, explicit backfill pass
-- (scripts/backfill_news_relevance.ts), never a side effect of the migration.

ALTER TABLE "NewsArticle" ADD COLUMN "relevance" TEXT NOT NULL DEFAULT 'ANIME_RELATED';
ALTER TABLE "NewsArticle" ADD COLUMN "relevanceScore" REAL NOT NULL DEFAULT 1.0;
ALTER TABLE "NewsArticle" ADD COLUMN "relevanceReason" TEXT;

CREATE INDEX "NewsArticle_relevance_idx" ON "NewsArticle"("relevance");
