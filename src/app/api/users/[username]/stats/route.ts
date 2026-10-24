import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

// Fallback when an anime has no usable duration on record.
const DEFAULT_EPISODE_MINUTES = 24;

/** "24 min per ep" -> 24; "1 hr 50 min" -> 110; anything unparsable -> null. */
function minutesFromDuration(duration: string | null): number | null {
  if (!duration) return null;
  const hr = /(\d+)\s*hr/i.exec(duration);
  const min = /(\d+)\s*min/i.exec(duration);
  const total = (hr ? Number(hr[1]) * 60 : 0) + (min ? Number(min[1]) : 0);
  return total > 0 ? total : null;
}

/**
 * GET /api/users/:username/stats
 * Profile stats computed from the database, so they are right for any profile
 * (not just the viewer's own) and change the moment a status, episode count or
 * rating changes.
 */
export async function GET(_request: NextRequest, { params }: { params: { username: string } }) {
  try {
    const user = await prisma.user.findFirst({
      where: { username: decodeURIComponent(params.username) },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const [entries, ratings] = await Promise.all([
      prisma.userAnime.findMany({
        where: { userId: user.id },
        select: { status: true, episodesWatched: true, anime: { select: { duration: true } } },
      }),
      prisma.animeRating.aggregate({
        where: { userId: user.id, deletedAt: null },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const byStatus = (s: string) => entries.filter((e) => e.status === s).length;
    const episodes = entries.reduce((a, e) => a + (e.episodesWatched || 0), 0);
    const minutes = entries.reduce((a, e) => a + (e.episodesWatched || 0) * (minutesFromDuration(e.anime.duration) ?? DEFAULT_EPISODE_MINUTES), 0);

    return NextResponse.json({
      completed: byStatus('COMPLETED'),
      watching: byStatus('WATCHING'),
      planToWatch: byStatus('PLAN_TO_WATCH'),
      onHold: byStatus('ON_HOLD'),
      dropped: byStatus('DROPPED'),
      total: entries.length,
      episodes,
      watchMinutes: minutes,
      meanScore: ratings._count._all > 0 ? ratings._avg.rating : null,
      ratedCount: ratings._count._all,
    });
  } catch (error) {
    console.error('Error loading profile stats:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
