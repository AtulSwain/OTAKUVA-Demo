import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAnimeDisplayTitle } from '../../../../lib/animeTitleResolver';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'top_rated'; // top_rated, popular, favorited, trending
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '25', 10));
    const skip = (page - 1) * limit;

    let orderBy: any = [{ score: 'desc' }, { scoredBy: 'desc' }];
    if (category === 'popular') {
      orderBy = [{ popularity: 'asc' }, { members: 'desc' }];
    } else if (category === 'favorited') {
      orderBy = [{ favoritesCount: 'desc' }, { score: 'desc' }];
    } else if (category === 'trending') {
      orderBy = [{ members: 'desc' }, { updatedAt: 'desc' }];
    }

    const where: any = { status: { not: 'MERGED' } };

    const [items, total] = await Promise.all([
      prisma.anime.findMany({
        where,
        orderBy,
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

    const mapped = items.map((a, idx) => {
      const displayTitle = getAnimeDisplayTitle(a);
      const enTitle = a.titles.find((t) => t.type === 'english')?.title;
      return {
        rank: skip + idx + 1,
        id: a.id,
        slug: a.slug,
        title: displayTitle,
        canonicalTitle: displayTitle,
        englishTitle: enTitle || displayTitle,
        posterImage: a.posterUrl,
        score: a.score,
        episodes: a.episodes,
        status: a.status,
        type: a.type,
        year: a.year,
        popularity: a.popularity,
        members: a.members || 0,
        favoritesCount: a.favoritesCount || 0,
        genres: a.animeGenres.map((g) => g.genre.name),
        studios: a.animeStudios.map((s) => s.studio.name),
      };
    });

    return NextResponse.json({
      category,
      items: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    console.error('Rankings API error:', err);
    return NextResponse.json({ error: 'Failed to fetch anime rankings' }, { status: 500 });
  }
}
