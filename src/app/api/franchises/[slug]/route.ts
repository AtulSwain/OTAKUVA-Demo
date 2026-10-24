import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;

    const franchise = await prisma.franchise.findFirst({
      where: {
        OR: [{ slug }, { id: slug }],
      },
      include: {
        items: {
          include: {
            anime: {
              include: {
                animeGenres: { include: { genre: true } },
                animeStudios: { include: { studio: true } },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!franchise) {
      return NextResponse.json({ error: 'Franchise not found' }, { status: 404 });
    }

    const productions = franchise.items.map((item) => ({
      id: item.anime.id,
      slug: item.anime.slug,
      title: item.anime.canonicalTitle,
      type: item.anime.type,
      status: item.anime.status,
      episodes: item.anime.episodes,
      score: item.anime.score,
      year: item.anime.year || item.anime.startYear,
      startDate: item.anime.startDate ? item.anime.startDate.toISOString() : null,
      posterUrl: item.anime.posterUrl,
      bannerUrl: item.anime.bannerUrl,
      relationship: item.relationship,
      position: item.position,
      genres: item.anime.animeGenres.map((ag) => ag.genre.name),
      studios: item.anime.animeStudios.map((as) => ({ id: as.studio.id, name: as.studio.name, slug: as.studio.slug })),
    }));

    // Generate Release Order (sorted by release date/year)
    const releaseOrder = [...productions].sort((a, b) => {
      const yearA = a.year || 9999;
      const yearB = b.year || 9999;
      return yearA - yearB;
    });

    return NextResponse.json({
      franchise: {
        id: franchise.id,
        name: franchise.name,
        slug: franchise.slug,
        description: franchise.description,
        totalProductions: productions.length,
        productions,
        releaseOrder,
        recommendedOrder: productions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching franchise:', error);
    return NextResponse.json({ error: 'Failed to fetch franchise' }, { status: 500 });
  }
}
