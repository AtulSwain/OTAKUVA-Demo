CREATE TABLE "SponsorAd" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "imageUrl" TEXT,
  "videoUrl" TEXT,
  "clickUrl" TEXT NOT NULL,
  "altText" TEXT,
  "placement" TEXT NOT NULL DEFAULT 'HOME_ABOVE_HYPE',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SponsorAd_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CommissionProduct" (
  "id" TEXT NOT NULL,
  "animeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "merchant" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "imageUrl" TEXT,
  "price" TEXT,
  "disclosure" TEXT DEFAULT 'As an affiliate, OTAKUVA may earn from qualifying purchases.',
  "position" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionProduct_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SponsorAd_enabled_placement_startsAt_endsAt_idx" ON "SponsorAd"("enabled", "placement", "startsAt", "endsAt");
CREATE INDEX "CommissionProduct_animeId_enabled_position_idx" ON "CommissionProduct"("animeId", "enabled", "position");
ALTER TABLE "SponsorAd" ADD CONSTRAINT "SponsorAd_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionProduct" ADD CONSTRAINT "CommissionProduct_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
