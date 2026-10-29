-- Control center: owner-made charts (Top 10 / Top 100 / OTAKUVA Choice …) and
-- the homepage's daily OTAKUVA Choice pick (2026-10-28). Additive only.
-- Hand-written (see CLAUDE.md: never `migrate dev` here).
CREATE TABLE "CuratedChart" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "size" INTEGER NOT NULL DEFAULT 10,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuratedChart_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CuratedChart_slug_key" ON "CuratedChart"("slug");

CREATE TABLE "CuratedChartEntry" (
  "id" TEXT NOT NULL,
  "chartId" TEXT NOT NULL,
  "animeId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuratedChartEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CuratedChartEntry_chartId_animeId_key" ON "CuratedChartEntry"("chartId", "animeId");
CREATE INDEX "CuratedChartEntry_chartId_position_idx" ON "CuratedChartEntry"("chartId", "position");
ALTER TABLE "CuratedChartEntry" ADD CONSTRAINT "CuratedChartEntry_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "CuratedChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuratedChartEntry" ADD CONSTRAINT "CuratedChartEntry_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DailyPick" (
  "id" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "animeId" TEXT NOT NULL,
  "headline" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyPick_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyPick_day_key" ON "DailyPick"("day");
ALTER TABLE "DailyPick" ADD CONSTRAINT "DailyPick_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
