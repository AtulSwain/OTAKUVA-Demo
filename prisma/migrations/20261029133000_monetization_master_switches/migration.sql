CREATE TABLE "MonetizationSetting" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "sponsorAdsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "commissionsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonetizationSetting_pkey" PRIMARY KEY ("id")
);
INSERT INTO "MonetizationSetting" ("id", "sponsorAdsEnabled", "commissionsEnabled", "updatedAt") VALUES ('main', false, false, CURRENT_TIMESTAMP);
