import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [settings] = await prisma.$queryRaw<{ sponsorAdsEnabled: boolean }[]>`SELECT "sponsorAdsEnabled" FROM "MonetizationSetting" WHERE id = 'main' LIMIT 1`;
  if (!settings?.sponsorAdsEnabled) return NextResponse.json({ ads: [] });
  const now = new Date();
  const ads = await prisma.$queryRaw<{ id: string; title: string; imageUrl: string | null; videoUrl: string | null; clickUrl: string; altText: string | null }[]>`SELECT id, title, "imageUrl", "videoUrl", "clickUrl", "altText" FROM "SponsorAd" WHERE enabled = true AND placement = 'HOME_ABOVE_HYPE' AND ("startsAt" IS NULL OR "startsAt" <= ${now}) AND ("endsAt" IS NULL OR "endsAt" >= ${now}) ORDER BY "updatedAt" DESC LIMIT 3`;
  return NextResponse.json({ ads }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
