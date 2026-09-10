import { prisma } from './prisma';

export interface SimilarAnimeResult {
  id: string;
  slug: string;
  title: string;
  posterImage: string;
  score: number | null;
  year: number | null;
  similarityScore: number;
  matchedAttributes: string[];
}

export interface UserTasteProfile {
  topGenres: { name: string; count: number }[];
  topThemes: { name: string; count: number }[];
  topStudios: { name: string; count: number }[];
  topDecades: { decade: string; count: number }[];
  totalWatchedEpisodes: number;
  totalCompletedAnime: number;
  averageRating: number | null;
}

/**
 * Get Deterministic Content-Based Similar Anime (Section 61 & 62)
 */
export async function getSimilarAnime(animeId: string, limit: number = 6): Promise<SimilarAnimeResult[]> {
  const target = await prisma.anime.findUnique({
    where: { id: animeId },
    include: {
      animeGenres: { include: { genre: true } },
      animeThemes: { include: { theme: true } },
      animeTags: true,
      animeStudios: { include: { studio: true } },
      relationsFrom: { include: { targetAnime: true } },
    },
  });

  if (!target) return [];

  const targetGenreIds = new Set(target.animeGenres.map((ag) => ag.genreId));
  const targetThemeIds = new Set(target.animeThemes.map((at) => at.themeId));
  const targetTagNames = new Set(target.animeTags.map((at) => at.name.toLowerCase()));
  const targetStudioIds = new Set(target.animeStudios.map((as) => as.studioId));

  const candidates = await prisma.anime.findMany({
    where: {
      id: { not: animeId },
      OR: [
        { animeGenres: { some: { genreId: { in: Array.from(targetGenreIds) } } } },
        { animeThemes: { some: { themeId: { in: Array.from(targetThemeIds) } } } },
        { animeStudios: { some: { studioId: { in: Array.from(targetStudioIds) } } } },
      ],
    },
    take: 40,
    include: {
      animeGenres: { include: { genre: true } },
      animeThemes: { include: { theme: true } },
      animeTags: true,
      animeStudios: { include: { studio: true } },
    },
  });

  const scored: SimilarAnimeResult[] = [];

  for (const c of candidates) {
    let score = 0;
    const matched: string[] = [];

    // Genre overlap (+15 pts per match)
    c.animeGenres.forEach((ag) => {
      if (targetGenreIds.has(ag.genreId)) {
        score += 15;
        if (!matched.includes(ag.genre.name)) matched.push(ag.genre.name);
      }
    });

    // Theme overlap (+20 pts per match)
    c.animeThemes.forEach((at) => {
      if (targetThemeIds.has(at.themeId)) {
        score += 20;
        if (!matched.includes(at.theme.name)) matched.push(at.theme.name);
      }
    });

    // Tag overlap (+10 pts per match)
    c.animeTags.forEach((at) => {
      if (targetTagNames.has(at.name.toLowerCase())) {
        score += 10;
      }
    });

    // Studio match (+25 pts)
    c.animeStudios.forEach((as) => {
      if (targetStudioIds.has(as.studioId)) {
        score += 25;
        if (!matched.includes(as.studio.name)) matched.push(as.studio.name);
      }
    });

    // Format & Era similarity (+10 pts)
    if (c.type === target.type) score += 10;
    if (c.startYear && target.startYear && Math.abs(c.startYear - target.startYear) <= 5) score += 10;

    scored.push({
      id: c.id,
      slug: c.slug,
      title: c.canonicalTitle,
      posterImage: c.posterUrl,
      score: c.score,
      year: c.year || c.startYear,
      similarityScore: score,
      matchedAttributes: matched.slice(0, 3),
    });
  }

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.slice(0, limit);
}

/**
 * Build User Taste Representation (Section 63)
 */
export async function buildUserTasteProfile(userId: string): Promise<UserTasteProfile> {
  const [userAnimes, ratings] = await Promise.all([
    prisma.userAnime.findMany({
      where: { userId },
      include: {
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
            animeThemes: { include: { theme: true } },
            animeStudios: { include: { studio: true } },
          },
        },
      },
    }),
    prisma.animeRating.findMany({ where: { userId } }),
  ]);

  const genreCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};
  const studioCounts: Record<string, number> = {};
  const decadeCounts: Record<string, number> = {};
  let totalEpisodes = 0;
  let completedCount = 0;

  userAnimes.forEach((ua) => {
    totalEpisodes += ua.episodesWatched;
    if (ua.status === 'COMPLETED') completedCount++;

    ua.anime.animeGenres.forEach((ag) => {
      genreCounts[ag.genre.name] = (genreCounts[ag.genre.name] || 0) + 1;
    });

    ua.anime.animeThemes.forEach((at) => {
      themeCounts[at.theme.name] = (themeCounts[at.theme.name] || 0) + 1;
    });

    ua.anime.animeStudios.forEach((as) => {
      studioCounts[as.studio.name] = (studioCounts[as.studio.name] || 0) + 1;
    });

    const yr = ua.anime.year || ua.anime.startYear;
    if (yr) {
      const dec = `${Math.floor(yr / 10) * 10}s`;
      decadeCounts[dec] = (decadeCounts[dec] || 0) + 1;
    }
  });

  const avgRating =
    ratings.length > 0
      ? Number((ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length).toFixed(2))
      : null;

  return {
    topGenres: Object.entries(genreCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topThemes: Object.entries(themeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topStudios: Object.entries(studioCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topDecades: Object.entries(decadeCounts)
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    totalWatchedEpisodes: totalEpisodes,
    totalCompletedAnime: completedCount,
    averageRating: avgRating,
  };
}
