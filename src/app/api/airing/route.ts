import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { syncEngine } from '../../../lib/syncEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get('day'); // optional day filter e.g. "monday"

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let schedules = await prisma.airingSchedule.findMany({
      where: {
        airingAt: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          lte: sevenDaysLater,
        },
      },
      orderBy: { airingAt: 'asc' },
      include: {
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
            animeStudios: { include: { studio: true } },
          },
        },
      },
    });

    // If local schedule is sparse, sync live broadcast schedule
    if (schedules.length === 0) {
      try {
        await syncEngine.syncWeeklySchedule();
        schedules = await prisma.airingSchedule.findMany({
          where: {
            airingAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
              lte: sevenDaysLater,
            },
          },
          orderBy: { airingAt: 'asc' },
          include: {
            anime: {
              include: {
                animeGenres: { include: { genre: true } },
                animeStudios: { include: { studio: true } },
              },
            },
          },
        });
      } catch (err: any) {
        console.warn('Airing schedule sync fallback error:', err?.message);
      }
    }

    const formatted = schedules.map((s) => {
      const airingDate = new Date(s.airingAt);
      const timeRemaining = Math.max(0, Math.floor((airingDate.getTime() - Date.now()) / 1000));

      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = daysOfWeek[airingDate.getDay()];

      return {
        id: s.id,
        animeId: s.animeId,
        slug: s.anime.slug,
        title: s.anime.canonicalTitle,
        episodeNumber: s.episode,
        airingAt: s.airingAt.toISOString(),
        timeUntilAiring: timeRemaining,
        dayOfWeek: dayName,
        posterUrl: s.anime.posterUrl,
        bannerUrl: s.anime.bannerUrl,
        type: s.anime.type,
        score: s.anime.score,
        genres: s.anime.animeGenres.map((ag) => ag.genre.name),
        studios: s.anime.animeStudios.map((as) => as.studio.name),
      };
    });

    let filtered = formatted;
    if (day && day.toLowerCase() !== 'all') {
      filtered = formatted.filter((item) => item.dayOfWeek.toLowerCase() === day.toLowerCase());
    }

    return NextResponse.json({
      schedule: filtered,
      totalAiringThisWeek: formatted.length,
    });
  } catch (error: any) {
    console.error('Error fetching airing calendar:', error);
    return NextResponse.json({ error: 'Failed to fetch airing calendar' }, { status: 500 });
  }
}
