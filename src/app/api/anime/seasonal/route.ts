import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAnimeDisplayTitle } from '../../../../lib/animeTitleResolver';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentYear = now.getFullYear();

    // Determine current anime season
    const month = now.getMonth() + 1;
    let defaultSeason = 'WINTER';
    if (month >= 4 && month <= 6) defaultSeason = 'SPRING';
    else if (month >= 7 && month <= 9) defaultSeason = 'SUMMER';
    else if (month >= 10 && month <= 12) defaultSeason = 'FALL';

    const season = (searchParams.get('season') || defaultSeason).toUpperCase();
    const year = parseInt(searchParams.get('year') || String(currentYear), 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '24', 10));
    const skip = (page - 1) * limit;

    const where: any = {
      season: { equals: season },
      year: { equals: year },
      status: { not: 'MERGED' },
    };

    const [items, total] = await Promise.all([
      prisma.anime.findMany({
        where,
        orderBy: { score: 'desc' },
        skip,
        take: limit,
        include: {
          animeGenres: { include: { genre: true } },
          animeStudios: { include: { studio: true } },
          titles: true,
        },
      }),
      prisma.anime.count({ where }),
    ]);

    const mapped = items.map((a) => {
      const displayTitle = getAnimeDisplayTitle(a);
      const enTitle = a.titles.find((t) => t.type === 'english')?.title;
      return {
        id: a.id,
        slug: a.slug,
        title: displayTitle,
        canonicalTitle: displayTitle,
        englishTitle: enTitle || displayTitle,
        posterImage: a.posterUrl,
        bannerImage: a.bannerUrl || a.posterUrl,
        score: a.score,
        episodes: a.episodes,
        status: a.status,
        type: a.type,
        year: a.year,
        season: a.season,
        genres: a.animeGenres.map((g) => g.genre.name),
        studios: a.animeStudios.map((s) => s.studio.name),
      };
    });

    return NextResponse.json({
      season,
      year,
      items: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    console.error('Seasonal API error:', err);
    return NextResponse.json({ error: 'Failed to fetch seasonal anime' }, { status: 500 });
  }
}
