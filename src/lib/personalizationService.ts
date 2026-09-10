/**
 * OTAKUVA Personalization & Taste Profile Engine
 * Computes user affinity across genres, studios, rating patterns,
 * and generates personalized recommendation signals without altering
 * canonical OTAKUVA scores.
 */

import { prisma } from './prisma';

export interface RecommendationReason {
  type: 'GENRE_MATCH' | 'STUDIO_MATCH' | 'HIGHLY_RATED' | 'POPULAR_IN_COMMUNITY';
  label: string;
}

export interface PersonalizedAnimeItem {
  id: string;
  slug: string;
  title: string;
  posterImage: string;
  bannerImage: string;
  score: number | null;
  episodes: number | null;
  status: string;
  year?: number | null;
  season?: string | null;
  genres: string[];
  studios: string[];
  affinityPercentage: number;
  reason: RecommendationReason;
}

export interface UserTasteProfile {
  userId: string;
  totalRated: number;
  averageGivenScore: number;
  topGenres: { genre: string; weight: number }[];
  topStudios: { studio: string; weight: number }[];
  favoriteAnimeIds: string[];
  completedAnimeIds: string[];
  watchedAnimeIds: string[];
}

/**
 * Builds the algorithmic taste profile for an authenticated user
 */
export async function buildUserTasteProfile(userId: string): Promise<UserTasteProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      ratings: {
        where: { deletedAt: null },
        include: {
          anime: {
            include: {
              animeGenres: { include: { genre: true } },
              animeStudios: { include: { studio: true } },
            },
          },
        },
      },
      library: {
        include: {
          anime: {
            include: {
              animeGenres: { include: { genre: true } },
              animeStudios: { include: { studio: true } },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const genreWeights: Record<string, number> = {};
  const studioWeights: Record<string, number> = {};
  const favoriteAnimeIds: string[] = [];
  const completedAnimeIds: string[] = [];
  const watchedAnimeIds: string[] = [];

  let totalScoreSum = 0;
  let ratingCount = 0;

  // Process ratings
  user.ratings.forEach((r) => {
    ratingCount++;
    totalScoreSum += r.rating;

    // Multiplier for positive ratings (>= 7.0 gives higher weight, >= 9.0 gives peak weight)
    const scoreMultiplier = r.rating >= 9.0 ? 3.0 : r.rating >= 8.0 ? 2.0 : r.rating >= 7.0 ? 1.0 : 0.2;

    if (r.anime) {
      watchedAnimeIds.push(r.anime.id);
      r.anime.animeGenres?.forEach((ag) => {
        const gName = ag.genre.name;
        genreWeights[gName] = (genreWeights[gName] || 0) + scoreMultiplier;
      });

      r.anime.animeStudios?.forEach((as) => {
        const sName = as.studio.name;
        studioWeights[sName] = (studioWeights[sName] || 0) + scoreMultiplier * 1.5;
      });
    }
  });

  // Process Library / UserAnime tracking
  user.library.forEach((ua) => {
    if (!watchedAnimeIds.includes(ua.animeId)) {
      watchedAnimeIds.push(ua.animeId);
    }
    if (ua.favorite) {
      favoriteAnimeIds.push(ua.animeId);
      ua.anime?.animeGenres?.forEach((ag) => {
        const gName = ag.genre.name;
        genreWeights[gName] = (genreWeights[gName] || 0) + 2.5;
      });
    }
    if (ua.status === 'COMPLETED') {
      completedAnimeIds.push(ua.animeId);
    }
  });

  const sortedGenres = Object.entries(genreWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([genre, weight]) => ({ genre, weight }));

  const sortedStudios = Object.entries(studioWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([studio, weight]) => ({ studio, weight }));

  return {
    userId,
    totalRated: ratingCount,
    averageGivenScore: ratingCount > 0 ? Number((totalScoreSum / ratingCount).toFixed(2)) : 0,
    topGenres: sortedGenres,
    topStudios: sortedStudios,
    favoriteAnimeIds,
    completedAnimeIds,
    watchedAnimeIds,
  };
}

/**
 * Computes personalized recommendations for a user or trending discovery for a guest
 */
export async function getPersonalizedRecommendations(
  userId?: string | null,
  limit = 8
): Promise<{ recommendations: PersonalizedAnimeItem[]; isPersonalized: boolean }> {
  // Fetch all canonical anime with genres & studios
  const allAnimes = await prisma.anime.findMany({
    take: 50,
    orderBy: [{ score: 'desc' }, { popularity: 'desc' }],
    include: {
      animeGenres: { include: { genre: true } },
      animeStudios: { include: { studio: true } },
    },
  });

  if (!userId) {
    // GUEST DISCOVERY: High-ranked canonical titles with community signals
    const guestRecommendations: PersonalizedAnimeItem[] = allAnimes.slice(0, limit).map((a, idx) => ({
      id: a.id,
      slug: a.slug,
      title: a.canonicalTitle,
      posterImage: a.posterUrl,
      bannerImage: a.bannerUrl || a.posterUrl,
      score: a.score,
      episodes: a.episodes,
      status: a.status,
      year: a.year,
      season: a.season,
      genres: a.animeGenres.map((ag) => ag.genre.name),
      studios: a.animeStudios.map((as) => as.studio.name),
      affinityPercentage: Math.max(75, 98 - idx * 3),
      reason: {
        type: 'POPULAR_IN_COMMUNITY',
        label: a.score && a.score >= 9.0 ? 'Top Community Masterpiece' : 'Popular on OTAKUVA',
      },
    }));

    return { recommendations: guestRecommendations, isPersonalized: false };
  }

  const profile = await buildUserTasteProfile(userId);
  if (!profile || profile.watchedAnimeIds.length === 0) {
    // New user with no history yet -> fallback to top discovery
    return getPersonalizedRecommendations(null, limit);
  }

  const topGenreNames = profile.topGenres.slice(0, 3).map((g) => g.genre);
  const topStudioNames = profile.topStudios.slice(0, 2).map((s) => s.studio);

  // Score candidate anime
  const scoredCandidates: { anime: any; affinity: number; reason: RecommendationReason }[] = [];

  for (const a of allAnimes) {
    // Filter out already completed / watched
    if (profile.watchedAnimeIds.includes(a.id)) {
      continue;
    }

    const animeGenres = a.animeGenres.map((ag) => ag.genre.name);
    const animeStudios = a.animeStudios.map((as) => as.studio.name);

    let genreScore = 0;
    let matchingGenres: string[] = [];
    animeGenres.forEach((g) => {
      const match = profile.topGenres.find((tg) => tg.genre.toLowerCase() === g.toLowerCase());
      if (match) {
        genreScore += match.weight;
        matchingGenres.push(g);
      }
    });

    let studioScore = 0;
    let matchingStudio = '';
    animeStudios.forEach((s) => {
      const match = profile.topStudios.find((ts) => ts.studio.toLowerCase() === s.toLowerCase());
      if (match) {
        studioScore += match.weight * 2;
        matchingStudio = s;
      }
    });

    const canonicalScore = a.score || 7.5;
    // Total raw affinity score
    const totalAffinity = genreScore * 1.5 + studioScore * 2.0 + (canonicalScore - 7.0) * 1.2;

    // Normalizing percentage to 60..99%
    const affinityPercentage = Math.min(99, Math.max(65, Math.round(70 + totalAffinity * 2.5)));

    // Generate explanatory reason
    let reason: RecommendationReason;
    if (matchingStudio && studioScore > 3) {
      reason = {
        type: 'STUDIO_MATCH',
        label: `From ${matchingStudio}, your top-rated studio`,
      };
    } else if (matchingGenres.length > 0) {
      reason = {
        type: 'GENRE_MATCH',
        label: `Matches your affinity for ${matchingGenres.slice(0, 2).join(' & ')}`,
      };
    } else {
      reason = {
        type: 'HIGHLY_RATED',
        label: `Critically acclaimed (${canonicalScore.toFixed(1)}/10 OTAKUVA Score)`,
      };
    }

    scoredCandidates.push({
      anime: a,
      affinity: affinityPercentage,
      reason,
    });
  }

  // Sort by affinity
  scoredCandidates.sort((a, b) => b.affinity - a.affinity);

  const finalRecommendations: PersonalizedAnimeItem[] = scoredCandidates.slice(0, limit).map((c) => ({
    id: c.anime.id,
    slug: c.anime.slug,
    title: c.anime.canonicalTitle,
    posterImage: c.anime.posterUrl,
    bannerImage: c.anime.bannerUrl || c.anime.posterUrl,
    score: c.anime.score,
    episodes: c.anime.episodes,
    status: c.anime.status,
    year: c.anime.year,
    season: c.anime.season,
    genres: c.anime.animeGenres.map((ag: any) => ag.genre.name),
    studios: c.anime.animeStudios.map((as: any) => as.studio.name),
    affinityPercentage: c.affinity,
    reason: c.reason,
  }));

  return {
    recommendations: finalRecommendations,
    isPersonalized: true,
  };
}
