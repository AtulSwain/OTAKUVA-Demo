import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';

export const dynamic = 'force-dynamic';

const ADULT_GENRES = ['Hentai', 'Erotica'];

/** GET /api/genres — every genre with its anime count (adult genres left out), for pickers. */
export async function GET() {
  try {
    const rows = await prisma.genre.findMany({
      where: { name: { notIn: ADULT_GENRES } },
      select: { id: true, name: true, slug: true, _count: { select: { animeGenres: true } } },
      orderBy: { name: 'asc' },
    });
    const genres = rows.map((g) => ({ id: g.id, name: g.name, slug: g.slug, animeCount: g._count.animeGenres }));
    return NextResponse.json({ genres }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (error) {
    logger.error('Listing genres failed', { error, route: '/api/genres', method: 'GET' });
    return NextResponse.json({ error: 'Failed to load genres' }, { status: 500 });
  }
}
