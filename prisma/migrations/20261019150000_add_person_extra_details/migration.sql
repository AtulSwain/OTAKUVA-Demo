-- More creator profile facts from AniList (2026-10-19). Additive only.
-- Hand-written from `migrate diff --script`; its AnimeTitle "searchVector"
-- column + GIN index drops were left out (raw-SQL search, docs/production/SEARCH.md).

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "alternativeNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "anilistFavourites" INTEGER,
ADD COLUMN     "bloodType" TEXT,
ADD COLUMN     "extraDetailsFetchedAt" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "language" TEXT;
