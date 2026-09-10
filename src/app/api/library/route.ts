import { NextRequest } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { withApiHandler } from '../../../lib/api/apiHandler';
import { getAnimeDisplayTitle } from '../../../lib/animeTitleResolver';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('Library', async (request: NextRequest) => {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return {
      data: {
        items: [] as any[],
        counts: {
          watching: 0,
          completed: 0,
          plan_to_watch: 0,
          on_hold: 0,
          dropped: 0,
          total: 0,
        },
        todayEpisodesCount: 0,
        weekStreak: 0,
      },
      items: [] as any[],
      counts: {
        watching: 0,
        completed: 0,
        plan_to_watch: 0,
        on_hold: 0,
        dropped: 0,
        total: 0,
      },
      todayEpisodesCount: 0,
      weekStreak: 0,
    };
  }

  const userId = authUser.id;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [userAnimes, ratings, favorites, todayProgress, weekProgress, episodeProgress] = await Promise.all([
    prisma.userAnime.findMany({
      where: { userId },
      include: {
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
            animeStudios: { include: { studio: true } },
            titles: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.animeRating.findMany({ where: { userId } }),
    prisma.favorite.findMany({ where: { userId } }),
    prisma.userEpisodeProgress.count({
      where: {
        userId,
        watchedAt: { gte: startOfToday },
      },
    }),
    prisma.userEpisodeProgress.findMany({
      where: {
        userId,
        watchedAt: { gte: sevenDaysAgo },
      },
      select: { watchedAt: true },
    }),
    prisma.userEpisodeProgress.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { animeId: true, episodeId: true, episode: { select: { number: true } } },
    }),
  ]);

  const ratingMap = new Map(ratings.map((r) => [r.animeId, r.rating]));
  const favoriteSet = new Set(favorites.map((f) => f.animeId));
  const progressByAnime = new Map<string, { ids: string[]; numbers: number[] }>();
  for (const progress of episodeProgress) {
    const current = progressByAnime.get(progress.animeId) || { ids: [], numbers: [] };
    current.ids.push(progress.episodeId);
    current.numbers.push(progress.episode.number);
    progressByAnime.set(progress.animeId, current);
  }

  const counts = {
    watching: userAnimes.filter((a) => a.status === 'WATCHING').length,
    completed: userAnimes.filter((a) => a.status === 'COMPLETED').length,
    plan_to_watch: userAnimes.filter((a) => a.status === 'PLAN_TO_WATCH').length,
    on_hold: userAnimes.filter((a) => a.status === 'ON_HOLD').length,
    dropped: userAnimes.filter((a) => a.status === 'DROPPED').length,
    total: userAnimes.length,
  };

  const items = userAnimes.map((item) => {
    const anime = item.anime;
    const displayTitle = getAnimeDisplayTitle(anime);
    const genres = anime.animeGenres.map((ag) => ag.genre.name);
    const studios = anime.animeStudios.map((as) => as.studio.name);
    const englishTitle = anime.titles.find((t) => t.type === 'english')?.title || displayTitle;
    const japaneseTitle = anime.titles.find((t) => t.type === 'japanese')?.title || '';

    return {
      id: item.id,
      userId: item.userId,
      animeId: item.animeId,
      status: item.status.toLowerCase(),
      episodesWatched: item.episodesWatched,
      watchedEpisodeIds: progressByAnime.get(item.animeId)?.ids || [],
      watchedEpisodeNumbers: progressByAnime.get(item.animeId)?.numbers || [],
      personalRating: ratingMap.get(item.animeId) || null,
      isFavorite: favoriteSet.has(item.animeId),
      notes: item.notes,
      startDate: item.startDate,
      finishDate: item.finishDate,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      anime: {
        id: anime.id,
        slug: anime.slug,
        title: displayTitle,
        canonicalTitle: displayTitle,
        englishTitle,
        japaneseTitle,
        synopsis: anime.synopsis,
        type: anime.type,
        episodes: anime.episodes,
        status: anime.status,
        season: anime.season,
        year: anime.year,
        score: anime.score,
        ratingCount: anime.scoredBy || 0,
        rank: anime.rank,
        popularity: anime.popularity,
        posterImage: anime.posterUrl,
        bannerImage: anime.bannerUrl || anime.posterUrl,
        genres,
        studios: studios.length > 0 ? studios : ['Studio'],
        duration: anime.duration,
        source: anime.source,
      },
    };
  });

  return {
    data: {
      items,
      counts,
      userId,
      todayEpisodesCount: todayProgress,
      recentEpisodesLogged: weekProgress.length,
    },
    items,
    counts,
    userId,
    todayEpisodesCount: todayProgress,
    recentEpisodesLogged: weekProgress.length,
  };
});
