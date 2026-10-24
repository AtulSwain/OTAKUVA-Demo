import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/activities — the signed-in user's own activity (the /activity page).
 *
 * This used to return every member's activity to anyone, unauthenticated —
 * including library status changes and episode progress, which profiles
 * deliberately keep owner-only. Other people's public activity is served per
 * user by /api/users/[username]/activity.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const requested = parseInt(searchParams.get('limit') || '25', 10);
    const limit = Number.isFinite(requested) ? Math.min(50, Math.max(1, requested)) : 25;

    const activities = await prisma.activity.findMany({
      where: { userId: authUser.id },
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
