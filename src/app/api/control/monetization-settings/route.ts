import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';

export async function GET(request: NextRequest) {
  const auth = await requireControl(request); if (auth instanceof NextResponse) return auth;
  const [settings] = await prisma.$queryRaw<any[]>`SELECT id, "sponsorAdsEnabled", "commissionsEnabled", "updatedAt" FROM "MonetizationSetting" WHERE id = 'main' LIMIT 1`;
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireControl(request); if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const [settings] = await prisma.$queryRaw<any[]>`INSERT INTO "MonetizationSetting" (id, "sponsorAdsEnabled", "commissionsEnabled", "updatedAt") VALUES ('main', ${Boolean(body.sponsorAdsEnabled)}, ${Boolean(body.commissionsEnabled)}, NOW()) ON CONFLICT (id) DO UPDATE SET "sponsorAdsEnabled" = COALESCE(${body.sponsorAdsEnabled === undefined ? null : Boolean(body.sponsorAdsEnabled)}, "MonetizationSetting"."sponsorAdsEnabled"), "commissionsEnabled" = COALESCE(${body.commissionsEnabled === undefined ? null : Boolean(body.commissionsEnabled)}, "MonetizationSetting"."commissionsEnabled"), "updatedAt" = NOW() RETURNING id, "sponsorAdsEnabled", "commissionsEnabled", "updatedAt"`;
  return NextResponse.json({ settings });
}
