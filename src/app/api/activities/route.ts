import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '25', 10));

    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Populate anime info for activities linked to an anime
    const animeIds = activities.map((a) => a.animeId).filter(Boolean) as string[];
    const animes = await prisma.anime.findMany({
      where: { id: { in: animeIds } },
      select: {
        id: true,
        slug: true,
        canonicalTitle: true,
        posterUrl: true,
        type: true,
      },
    });

    const animeMap = new Map(animes.map((a) => [a.id, a]));

    const parsed = activities.map((act) => {
      let meta: any = {};
      try {
        if (act.metadata) meta = JSON.parse(act.metadata);
      } catch (e) {
        meta = {};
      }

      const anime = act.animeId ? animeMap.get(act.animeId) : null;

      return {
        id: act.id,
        type: act.type,
        createdAt: act.createdAt.toISOString(),
        user: act.user,
        anime: anime
          ? {
              id: anime.id,
              slug: anime.slug,
              title: anime.canonicalTitle,
              posterImage: anime.posterUrl,
              type: anime.type,
            }
          : null,
        metadata: meta,
      };
    });

    return NextResponse.json({ activities: parsed, total: parsed.length });
  } catch (error: any) {
    console.error('Error fetching activity feed:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}
