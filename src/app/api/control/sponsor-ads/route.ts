import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireControl(request); if (auth instanceof NextResponse) return auth;
  const ads = await prisma.$queryRaw<any[]>`SELECT id, title, "imageUrl", "videoUrl", "clickUrl", "altText", placement, enabled, "startsAt", "endsAt", "updatedAt" FROM "SponsorAd" ORDER BY "updatedAt" DESC`;
  return NextResponse.json({ ads });
}
export async function POST(request: NextRequest) {
  const auth = await requireControl(request); if (auth instanceof NextResponse) return auth;
  const b = await request.json();
  if (!String(b.title || '').trim() || !String(b.clickUrl || '').startsWith('https://') || (!b.imageUrl && !b.videoUrl)) return NextResponse.json({ error: 'Title, secure click URL, and an image or video are required.' }, { status: 400 });
  const [ad] = await prisma.$queryRaw<any[]>`INSERT INTO "SponsorAd" (id, title, "imageUrl", "videoUrl", "clickUrl", "altText", placement, enabled, "startsAt", "endsAt", "createdById", "createdAt", "updatedAt") VALUES (${randomUUID()}, ${String(b.title).trim().slice(0, 120)}, ${b.imageUrl ? String(b.imageUrl) : null}, ${b.videoUrl ? String(b.videoUrl) : null}, ${String(b.clickUrl).trim()}, ${b.altText ? String(b.altText).slice(0, 200) : null}, 'HOME_ABOVE_HYPE', true, ${b.startsAt ? new Date(b.startsAt) : null}, ${b.endsAt ? new Date(b.endsAt) : null}, ${auth.id}, NOW(), NOW()) RETURNING *`;
  await prisma.$executeRaw`UPDATE "MonetizationSetting" SET "sponsorAdsEnabled" = true, "updatedAt" = NOW() WHERE id = 'main'`;
  return NextResponse.json({ ad });
}
