-- "What's your vibe about this anime?" (2026-10-25): one grade per member,
-- per anime, per aspect. Additive only. Hand-written from `migrate diff`
-- with its "AnimeTitle"."searchVector" column/index drops removed (that's
-- the raw-SQL full-text index — see docs/production/SEARCH.md).

-- CreateTable
CREATE TABLE "AnimeVibe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeVibe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimeVibe_animeId_idx" ON "AnimeVibe"("animeId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeVibe_userId_animeId_category_key" ON "AnimeVibe"("userId", "animeId", "category");

-- AddForeignKey
ALTER TABLE "AnimeVibe" ADD CONSTRAINT "AnimeVibe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeVibe" ADD CONSTRAINT "AnimeVibe_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
