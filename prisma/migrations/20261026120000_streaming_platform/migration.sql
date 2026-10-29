-- Streaming platform art (2026-10-26): one row per streaming site with the
-- official icon + brand colour AniList publishes for it. Additive only.
-- Hand-written (never `migrate dev` here — see CLAUDE.md searchVector note).
CREATE TABLE "StreamingPlatform" (
    "id" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "anilistSiteId" INTEGER,
    "iconUrl" TEXT,
    "color" TEXT,
    "source" TEXT NOT NULL DEFAULT 'anilist',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StreamingPlatform_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StreamingPlatform_site_key" ON "StreamingPlatform"("site");
