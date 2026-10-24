import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { sanitizePublicEntityName } from '../../../../lib/normalizers';
import { isWideBanner } from '../../../../lib/media/heroArt';
import { logger } from '../../../../lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/collections/anime?ids=<id-or-slug>,…  (≤ 20)
 * Card data for the collection builder's starting anime (/collections/new?anime=…):
 * title, poster and — when it has one — the anime's wide AniList banner.
 */
export async function GET(request: NextRequest) {
  try {
    const ids = (request.nextUrl.searchParams.get('ids') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (ids.length === 0) return NextResponse.json({ anime: [] });
    const rows = await prisma.anime.findMany({
      where: { OR: [{ id: { in: ids } }, { slug: { in: ids } }], status: { not: 'MERGED' } },
      select: { id: true, slug: true, canonicalTitle: true, posterUrl: true, bannerUrl: true, year: true, type: true },
    });
    return NextResponse.json({
      anime: rows.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: sanitizePublicEntityName(a.canonicalTitle),
        posterUrl: a.posterUrl,
        bannerUrl: isWideBanner(a.bannerUrl) ? a.bannerUrl : null,
        year: a.year,
        type: a.type,
      })),
    });
  } catch (error) {
    logger.error('Collection anime lookup failed', { error, route: '/api/collections/anime', method: 'GET' });
    return NextResponse.json({ error: 'Could not load anime.' }, { status: 500 });
  }
}
