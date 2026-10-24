-- Creator details + provider ids on Person (2026-10-18).
-- Additive and nullable (occupations defaults to an empty array) — existing
-- rows are unaffected until the creator import fills them.
-- Hand-written (see CLAUDE.md: never `migrate dev` here; AnimeTitle.searchVector).

-- AlterTable
ALTER TABLE "Person" ADD COLUMN "anilistId" INTEGER,
ADD COLUMN "malId" INTEGER,
ADD COLUMN "homeTown" TEXT,
ADD COLUMN "yearsActive" TEXT,
ADD COLUMN "dateOfDeath" TEXT,
ADD COLUMN "occupations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "detailsFetchedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Person_anilistId_key" ON "Person"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_malId_key" ON "Person"("malId");
