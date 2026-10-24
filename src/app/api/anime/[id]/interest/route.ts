import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

async function resolveAnime(identifier: string) {
  return prisma.anime.findFirst({ where: { OR: [{ id: identifier }, { slug: identifier }] }, select: { id: true } });
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUserFromRequest(request);
  const anime = await resolveAnime(params.id);
  if (!anime) return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
  const [count, item] = await Promise.all([
    prisma.userAnime.count({ where: { animeId: anime.id, favorite: true } }),
    user ? prisma.userAnime.findUnique({ where: { userId_animeId: { userId: user.id, animeId: anime.id } }, select: { favorite: true } }) : null,
  ]);
  return NextResponse.json({ count, active: Boolean(item?.favorite) });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const anime = await resolveAnime(params.id);
  if (!anime) return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const active = Boolean(body.active);
  const item = await prisma.userAnime.upsert({
    where: { userId_animeId: { userId: user.id, animeId: anime.id } },
    create: { userId: user.id, animeId: anime.id, status: 'PLAN_TO_WATCH', favorite: active },
    update: { favorite: active },
    select: { favorite: true },
  });
  const count = await prisma.userAnime.count({ where: { animeId: anime.id, favorite: true } });
  return NextResponse.json({ count, active: item.favorite });
}
