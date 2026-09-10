import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { defaultAnimeProvider } from '../../../lib/providers';
import { syncEngine } from '../../../lib/syncEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    let upcoming = await prisma.anime.findMany({
      where: {
        OR: [
          { status: 'Not Yet Aired' },
          { status: 'NOT_YET_AIRED' },
          { year: { gte: new Date().getFullYear() } },
        ],
      },
      orderBy: [{ year: 'asc' }, { popularity: 'asc' }],
      take: 60,
      include: {
        animeGenres: { include: { genre: true } },
        animeStudios: { include: { studio: true } },
      },
    });

    // If sparse, fetch upcoming anime from provider
    if (upcoming.length < 5) {
      try {
        const providerRes = await defaultAnimeProvider.getUpcomingAnime(1, 25);
        for (const item of providerRes.items) {
          try {
            await syncEngine.ingestAnime(item, 'anilist');
          } catch (e) {}
        }

        upcoming = await prisma.anime.findMany({
          where: {
            OR: [
              { status: 'Not Yet Aired' },
              { status: 'NOT_YET_AIRED' },
              { year: { gte: new Date().getFullYear() } },
            ],
          },
          orderBy: [{ year: 'asc' }, { popularity: 'asc' }],
          take: 60,
          include: {
            animeGenres: { include: { genre: true } },
            animeStudios: { include: { studio: true } },
          },
        });
      } catch (err: any) {
        console.warn('Upcoming anime sync fallback error:', err?.message);
      }
    }

    const formatted = upcoming.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.canonicalTitle,
      type: a.type,
      status: a.status,
      season: a.season,
      year: a.year || a.startYear,
      startDate: a.startDate ? a.startDate.toISOString() : null,
      datePrecision: a.datePrecision,
      posterUrl: a.posterUrl,
      bannerUrl: a.bannerUrl,
      synopsis: a.synopsis,
      genres: a.animeGenres.map((ag) => ag.genre.name),
      studios: a.animeStudios.map((as) => as.studio.name),
    }));

    // Group logically by confirmed date, season/year, or unconfirmed
    const confirmedDate = formatted.filter((item) => item.datePrecision === 'DAY' && item.startDate);
    const seasonConfirmed = formatted.filter((item) => item.season && item.year && item.datePrecision !== 'DAY');
    const yearOnly = formatted.filter((item) => !item.season && item.year);
    const TBA = formatted.filter((item) => !item.year && !item.startDate);

    return NextResponse.json({
      total: formatted.length,
      grouped: {
        confirmedDate,
        seasonConfirmed,
        yearOnly,
        TBA,
      },
      allUpcoming: formatted,
    });
  } catch (error: any) {
    console.error('Error fetching upcoming anime:', error);
    return NextResponse.json({ error: 'Failed to fetch upcoming anime' }, { status: 500 });
  }
}
