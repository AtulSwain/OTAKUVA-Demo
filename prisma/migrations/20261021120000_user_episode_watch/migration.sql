-- Per-episode "watched" ticks by episode number (2026-10-21). Additive only.
-- Hand-written from `migrate diff --script` with the AnimeTitle.searchVector
-- column/index drops removed (that column is the raw-SQL full-text index,
-- deliberately absent from schema.prisma — see docs/production/SEARCH.md).

-- CreateTable
CREATE TABLE "UserEpisodeWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEpisodeWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserEpisodeWatch_userId_animeId_idx" ON "UserEpisodeWatch"("userId", "animeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserEpisodeWatch_userId_animeId_episodeNumber_key" ON "UserEpisodeWatch"("userId", "animeId", "episodeNumber");

-- AddForeignKey
ALTER TABLE "UserEpisodeWatch" ADD CONSTRAINT "UserEpisodeWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEpisodeWatch" ADD CONSTRAINT "UserEpisodeWatch_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
