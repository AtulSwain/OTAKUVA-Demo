-- Page views per page per day (2026-10-28): anime, news, articles, collections,
-- charts, studios, people. Counts only: no user id, no IP, no cookie.
-- Additive only; hand-written (see CLAUDE.md).
CREATE TABLE "PageViewDaily" (
  "kind" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PageViewDaily_pkey" PRIMARY KEY ("kind", "entityId", "day")
);
CREATE INDEX "PageViewDaily_kind_day_idx" ON "PageViewDaily"("kind", "day");
