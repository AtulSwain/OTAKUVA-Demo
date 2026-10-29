import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const [settings] = await prisma.$queryRaw<{ commissionsEnabled: boolean }[]>`SELECT "commissionsEnabled" FROM "MonetizationSetting" WHERE id = 'main' LIMIT 1`;
  if (!settings?.commissionsEnabled) return NextResponse.json({ products: [] });
  const anime = await prisma.anime.findFirst({ where: { OR: [{ id: params.id }, { slug: params.id }] }, select: { id: true } });
  if (!anime) return NextResponse.json({ products: [] });
  const products = await prisma.$queryRaw<{ id: string; title: string; merchant: string; url: string; imageUrl: string | null; price: string | null; disclosure: string | null }[]>`SELECT id, title, merchant, url, "imageUrl", price, disclosure FROM "CommissionProduct" WHERE "animeId" = ${anime.id} AND enabled = true ORDER BY position ASC LIMIT 10`;
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
}
