-- Per-episode ratings by anime + episode number, plus optional per-episode
-- aspect scores (2026-10-19). Additive; EpisodeRating had 0 rows, so making
-- episodeId optional is safe. Generated with `migrate diff --script`; its
-- AnimeTitle "searchVector" column + GIN index drops were removed
-- (raw-SQL search, docs/production/SEARCH.md).

-- DropForeignKey
ALTER TABLE "EpisodeRating" DROP CONSTRAINT "EpisodeRating_episodeId_fkey";

-- AlterTable
ALTER TABLE "EpisodeRating" ADD COLUMN     "animeId" TEXT,
ADD COLUMN     "episodeNumber" INTEGER,
ALTER COLUMN "episodeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EpisodeRatingCategoryScore" (
    "id" TEXT NOT NULL,
    "episodeRatingId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeRatingCategoryScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpisodeRatingCategoryScore_category_idx" ON "EpisodeRatingCategoryScore"("category");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeRatingCategoryScore_episodeRatingId_category_key" ON "EpisodeRatingCategoryScore"("episodeRatingId", "category");

-- CreateIndex
CREATE INDEX "EpisodeRating_animeId_episodeNumber_idx" ON "EpisodeRating"("animeId", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeRating_userId_animeId_episodeNumber_key" ON "EpisodeRating"("userId", "animeId", "episodeNumber");

-- AddForeignKey
ALTER TABLE "EpisodeRating" ADD CONSTRAINT "EpisodeRating_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeRating" ADD CONSTRAINT "EpisodeRating_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeRatingCategoryScore" ADD CONSTRAINT "EpisodeRatingCategoryScore_episodeRatingId_fkey" FOREIGN KEY ("episodeRatingId") REFERENCES "EpisodeRating"("id") ON DELETE CASCADE ON UPDATE CASCADE;
