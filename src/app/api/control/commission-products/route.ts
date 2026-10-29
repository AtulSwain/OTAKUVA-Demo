import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireControl(request); if (auth instanceof NextResponse) return auth;
  const animeId = request.nextUrl.searchParams.get('animeId');
  const anime = animeId ? await prisma.anime.findFirst({ where: { OR: [{ id: animeId }, { slug: animeId }] }, select: { id: true } }) : null;
  if (animeId && !anime) return NextResponse.json({ error: 'Anime not found. Use the anime slug or ID from the catalog.' }, { status: 404 });
  const products = anime ? await prisma.$queryRaw<any[]>`SELECT id, "animeId", title, merchant, url, "imageUrl", price, enabled, position, "createdAt", "updatedAt" FROM "CommissionProduct" WHERE "animeId" = ${anime.id} ORDER BY position ASC` : [];
  return NextResponse.json({ products });
}
export async function POST(request: NextRequest) {
  const auth = await requireControl(request); if (auth instanceof NextResponse) return auth;
  const b = await request.json(); const animeKey = String(b.animeId || '');
  const anime = await prisma.anime.findFirst({ where: { OR: [{ id: animeKey }, { slug: animeKey }] }, select: { id: true } });
  const countRows = anime ? await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "CommissionProduct" WHERE "animeId" = ${anime.id}` : [];
  const count = Number(countRows[0]?.count ?? 0);
  if (!anime || count >= 10 || !String(b.title || '').trim() || !['Amazon', 'Flipkart'].includes(String(b.merchant)) || !/^https:\/\//.test(String(b.url || ''))) return NextResponse.json({ error: 'Choose an anime, Amazon or Flipkart, a title, and a secure product URL. Maximum 10 products per anime.' }, { status: 400 });
  const [product] = await prisma.$queryRaw<any[]>`INSERT INTO "CommissionProduct" (id, "animeId", title, merchant, url, "imageUrl", price, position, enabled, "createdAt", "updatedAt") VALUES (${randomUUID()}, ${anime.id}, ${String(b.title).trim().slice(0, 160)}, ${String(b.merchant)}, ${String(b.url).trim()}, ${b.imageUrl ? String(b.imageUrl) : null}, ${b.price ? String(b.price).slice(0, 40) : null}, ${count}, ${Boolean(b.enabled)}, NOW(), NOW()) RETURNING *`;
  if (b.enabled) await prisma.$executeRaw`UPDATE "MonetizationSetting" SET "commissionsEnabled" = true, "updatedAt" = NOW() WHERE id = 'main'`;
  return NextResponse.json({ product });
}
