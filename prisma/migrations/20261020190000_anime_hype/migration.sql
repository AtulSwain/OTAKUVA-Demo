-- Hype Meter (2026-10-20): pre-premiere anticipation votes, one per member per
-- anime, open until episode 1 airs. Additive only (new table).


-- CreateTable
CREATE TABLE "AnimeHype" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeHype_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimeHype_animeId_level_idx" ON "AnimeHype"("animeId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeHype_userId_animeId_key" ON "AnimeHype"("userId", "animeId");

-- AddForeignKey
ALTER TABLE "AnimeHype" ADD CONSTRAINT "AnimeHype_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeHype" ADD CONSTRAINT "AnimeHype_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

