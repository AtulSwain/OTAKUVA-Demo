/**
 * OTAKUVA ENGINE — PHASE 10.2
 * USER TASTE / PREFERENCE PROFILE ENGINE
 * 
 * Persistent, explainable, multi-dimensional user preference vectors:
 * - Multi-dimensional vectors (Genres, Themes, Studios, Formats, Lengths, Seasonality, Creators, Review Aspects)
 * - Short-Term (30-day window) vs Long-Term (exponential half-life decay) profiles
 * - Bounded normalization (-1.0 to 1.0) with asymptotic confidence scaling
 * - Explicit user feedback integration (More/Less Like This, Not Interested)
 * - Controlled reset of derived personalization state
 * - Plain-language human-readable preference explanations
 */

import { prisma } from '../../prisma';
import { registerEventListener } from '../events/eventEngine';

export const TASTE_ENGINE_VERSION = 2;

export interface TasteSignalDetail {
  score: number; // Bounded -1.0 to 1.0
  confidence: number; // 0.0 to 1.0
  evidenceCount: number;
  evidence: string[];
}

export interface UserTasteProfileResult {
  userId: string;
  profileVersion: number;
  confidenceTier: 'COLD_START' | 'NEW_USER' | 'LOW_CONFIDENCE' | 'LEARNING' | 'ESTABLISHED';
  overallConfidence: number;
  totalSignalsCount: number;
  genres: Record<string, TasteSignalDetail>;
  themes: Record<string, TasteSignalDetail>;
  studios: Record<string, TasteSignalDetail>;
  producers: Record<string, TasteSignalDetail>;
  formats: Record<string, TasteSignalDetail>;
  lengths: Record<string, TasteSignalDetail>;
  seasonality: Record<string, TasteSignalDetail>;
  creators: Record<string, TasteSignalDetail>;
  aspects: Record<string, TasteSignalDetail>;
  shortTerm: {
    genres: Record<string, number>;
    themes: Record<string, number>;
    studios: Record<string, number>;
  };
  genreAffinities: { name: string; score: number }[];
  themeAffinities: { name: string; score: number }[];
  studioAffinities: { name: string; score: number }[];
  topGenres: string[];
  topThemes: string[];
  topStudios: string[];
  topFormats: string[];
  topLengths: string[];
  userFacingInsights: string[];
  updatedAt: string;
}

export const TASTE_CONFIG = {
  WEIGHTS: {
    EXPLICIT_RATING_WEIGHT: 3.0,
    EPISODE_RATING_WEIGHT: 1.5,
    COMPLETED_ANIME_WEIGHT: 2.0,
    WATCHING_ANIME_WEIGHT: 1.0,
    BOOKMARK_WEIGHT: 1.2,
    POSITIVE_REVIEW_ASPECT_WEIGHT: 1.8,
    NEGATIVE_REVIEW_ASPECT_WEIGHT: -1.8,
    DROPPED_WITH_LOW_RATING_WEIGHT: -2.5,
    DROPPED_WITHOUT_RATING_WEIGHT: -0.5,
    FEEDBACK_MORE_LIKE_THIS: 2.5,
    FEEDBACK_LESS_LIKE_THIS: -2.0,
    FEEDBACK_NOT_INTERESTED: -3.5,
  },
  TIME_DECAY_HALF_LIFE_DAYS: 180, // 6 months half-life
  SHORT_TERM_WINDOW_DAYS: 30,
  SATURATION_DIVISOR: 8.0,
};

/**
 * Calculates exponential time decay weight for an interaction
 */
export function calculateTimeDecay(interactionDate: Date): number {
  const now = Date.now();
  const ageMs = Math.max(0, now - new Date(interactionDate).getTime());
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const decay = Math.pow(2, -ageDays / TASTE_CONFIG.TIME_DECAY_HALF_LIFE_DAYS);
  return Math.max(0.1, parseFloat(decay.toFixed(3)));
}

/**
 * Bounded sigmoid/tanh normalization mapping raw accumulator to [-1.0, 1.0]
 */
export function normalizeBounded(val: number): number {
  const normalized = Math.tanh(val / TASTE_CONFIG.SATURATION_DIVISOR);
  return parseFloat(normalized.toFixed(2));
}

/**
 * Rebuilds the user's complete taste profile from historical data
 */
export async function rebuildTasteProfile(userId: string): Promise<UserTasteProfileResult> {
  const thirtyDaysAgo = new Date(Date.now() - TASTE_CONFIG.SHORT_TERM_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [ratings, episodeRatings, library, bookmarks, reviews, explicitFeedback] = await Promise.all([
    // 1. Explicit Anime Ratings
    prisma.animeRating.findMany({
      where: { userId, deletedAt: null },
      include: {
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
            animeThemes: { include: { theme: true } },
            animeStudios: { include: { studio: true } },
            animeProducers: { include: { producer: true } },
            staff: { include: { person: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),

    // 2. Per-Episode Ratings
    prisma.episodeRating.findMany({
      where: { userId },
      include: {
        episode: {
          include: {
            anime: {
              include: {
                animeGenres: { include: { genre: true } },
                animeThemes: { include: { theme: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // 3. Library Tracking Entries
    prisma.userAnime.findMany({
      where: { userId },
      include: {
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
            animeThemes: { include: { theme: true } },
            animeStudios: { include: { studio: true } },
            staff: { include: { person: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),

    // 4. Bookmarks (Favorites)
    prisma.favorite.findMany({
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

    // 5. Written Reviews and Extracted Aspects
    prisma.review.findMany({
      where: { userId, deletedAt: null },
      include: {
        aspects: true,
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
          },
        },
      },
    }),

    // 6. Explicit Recommendation Feedback
    prisma.recommendationFeedback.findMany({
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
  ]);

  // Raw signal accumulators (Long-Term & Short-Term)
  const genreAcc: Record<string, { raw: number; evidence: string[]; count: number }> = {};
  const themeAcc: Record<string, { raw: number; evidence: string[]; count: number }> = {};
  const studioAcc: Record<string, { raw: number; evidence: string[]; count: number }> = {};
  const producerAcc: Record<string, { raw: number; evidence: string[]; count: number }> = {};
  const formatAcc: Record<string, { raw: number; evidence: string[]; count: number }> = {};
  const lengthAcc: Record<string, { raw: number; evidence: string[]; count: number }> = {};
  const seasonalityAcc: Record<string, { raw: number; evidence: string[]; count: number }> = {};
  const creatorAcc: Record<string, { raw: number; evidence: string[]; count: number }> = {};
  const aspectAcc: Record<string, { raw: number; evidence: string[]; count: number }> = {};

  const shortTermGenres: Record<string, number> = {};
  const shortTermThemes: Record<string, number> = {};
  const shortTermStudios: Record<string, number> = {};

  let totalSignalCount = 0;

  const addSignal = (
    map: Record<string, { raw: number; evidence: string[]; count: number }>,
    key: string,
    delta: number,
    evidenceText: string,
    interactionDate?: Date,
    shortTermMap?: Record<string, number>
  ) => {
    if (!key) return;
    if (!map[key]) {
      map[key] = { raw: 0, evidence: [], count: 0 };
    }
    map[key].raw += delta;
    map[key].count += 1;
    if (map[key].evidence.length < 5 && !map[key].evidence.includes(evidenceText)) {
      map[key].evidence.push(evidenceText);
    }
    totalSignalCount++;

    if (interactionDate && interactionDate >= thirtyDaysAgo && shortTermMap) {
      shortTermMap[key] = (shortTermMap[key] || 0) + delta;
    }
  };

  // --- PASS 1: Explicit Anime Ratings ---
  for (const r of ratings) {
    const decay = calculateTimeDecay(r.updatedAt);
    const normalizedScore = (r.rating - 5) / 5;
    const weight = normalizedScore * TASTE_CONFIG.WEIGHTS.EXPLICIT_RATING_WEIGHT * decay;
    const title = r.anime.canonicalTitle;

    const genreCount = Math.max(1, r.anime.animeGenres.length);
    r.anime.animeGenres.forEach((g) => {
      addSignal(genreAcc, g.genre.name, (weight * 2.0) / Math.sqrt(genreCount), `Rated ${r.rating}/10 on "${title}"`, r.updatedAt, shortTermGenres);
    });

    const themeCount = Math.max(1, r.anime.animeThemes.length);
    r.anime.animeThemes.forEach((t) => {
      addSignal(themeAcc, t.theme.name, (weight * 1.5) / Math.sqrt(themeCount), `Rated ${r.rating}/10 on "${title}"`, r.updatedAt, shortTermThemes);
    });

    r.anime.animeStudios.forEach((s) => {
      addSignal(studioAcc, s.studio.name, weight * 1.5, `Rated ${r.rating}/10 on "${title}"`, r.updatedAt, shortTermStudios);
    });

    r.anime.animeProducers.forEach((p) => {
      addSignal(producerAcc, p.producer.name, weight * 1.0, `Rated ${r.rating}/10 on "${title}"`);
    });

    // Format & Length Inference
    if (r.anime.type) {
      addSignal(formatAcc, r.anime.type, weight * 1.0, `Rated ${r.rating}/10 on ${r.anime.type} title "${title}"`);
    }
    if (r.anime.episodes) {
      const lenBucket = r.anime.episodes <= 13 ? 'SHORT' : r.anime.episodes <= 26 ? 'MEDIUM' : 'LONG';
      addSignal(lengthAcc, lenBucket, weight * 1.0, `Rated ${r.rating}/10 on ${lenBucket} series "${title}"`);
    }
    if (r.anime.year) {
      const currentYear = new Date().getFullYear();
      const seasonBucket = r.anime.year >= currentYear - 3 ? 'RECENT' : 'CLASSIC';
      addSignal(seasonalityAcc, seasonBucket, weight * 0.8, `Rated ${r.rating}/10 on ${seasonBucket} release "${title}"`);
    }

    // Key Creators
    r.anime.staff.forEach((st) => {
      if (st.role?.toLowerCase().includes('director') || st.role?.toLowerCase().includes('creator')) {
        addSignal(creatorAcc, st.person.name, weight * 1.2, `Directed/Created "${title}" (Rated ${r.rating}/10)`);
      }
    });
  }

  // --- PASS 2: Library Completion & Drops ---
  for (const item of library) {
    const decay = calculateTimeDecay(item.updatedAt);
    const title = item.anime.canonicalTitle;

    if (item.status === 'COMPLETED') {
      const compWeight = TASTE_CONFIG.WEIGHTS.COMPLETED_ANIME_WEIGHT * decay;
      item.anime.animeGenres.forEach((g) => {
        addSignal(genreAcc, g.genre.name, compWeight, `Completed "${title}"`, item.updatedAt, shortTermGenres);
      });
      item.anime.animeThemes.forEach((t) => {
        addSignal(themeAcc, t.theme.name, compWeight, `Completed "${title}"`, item.updatedAt, shortTermThemes);
      });
      item.anime.animeStudios.forEach((s) => {
        addSignal(studioAcc, s.studio.name, compWeight, `Completed "${title}"`, item.updatedAt, shortTermStudios);
      });
      if (item.anime.type) {
        addSignal(formatAcc, item.anime.type, compWeight * 0.8, `Completed ${item.anime.type} title "${title}"`);
      }
    } else if (item.status === 'DROPPED') {
      const dropWeight =
        item.score !== null && item.score < 5
          ? TASTE_CONFIG.WEIGHTS.DROPPED_WITH_LOW_RATING_WEIGHT * decay
          : TASTE_CONFIG.WEIGHTS.DROPPED_WITHOUT_RATING_WEIGHT * decay;

      item.anime.animeGenres.forEach((g) => {
        addSignal(genreAcc, g.genre.name, dropWeight, `Dropped "${title}"`);
      });
      item.anime.animeThemes.forEach((t) => {
        addSignal(themeAcc, t.theme.name, dropWeight, `Dropped "${title}"`);
      });
    } else if (item.status === 'WATCHING') {
      const watchWeight = TASTE_CONFIG.WEIGHTS.WATCHING_ANIME_WEIGHT * decay;
      item.anime.animeGenres.forEach((g) => {
        addSignal(genreAcc, g.genre.name, watchWeight, `Currently tracking "${title}"`, item.updatedAt, shortTermGenres);
      });
    }
  }

  // --- PASS 3: Bookmarks ---
  for (const b of bookmarks) {
    const decay = calculateTimeDecay(b.createdAt);
    const title = b.anime.canonicalTitle;
    const bWeight = TASTE_CONFIG.WEIGHTS.BOOKMARK_WEIGHT * decay;

    b.anime.animeGenres.forEach((g) => {
      addSignal(genreAcc, g.genre.name, bWeight, `Bookmarked "${title}"`, b.createdAt, shortTermGenres);
    });
    b.anime.animeThemes.forEach((t) => {
      addSignal(themeAcc, t.theme.name, bWeight, `Bookmarked "${title}"`, b.createdAt, shortTermThemes);
    });
    b.anime.animeStudios.forEach((s) => {
      addSignal(studioAcc, s.studio.name, bWeight, `Bookmarked "${title}"`, b.createdAt, shortTermStudios);
    });
  }

  // --- PASS 4: Reviews and Aspects ---
  for (const rev of reviews) {
    const decay = calculateTimeDecay(rev.createdAt);
    const title = rev.anime.canonicalTitle;

    for (const asp of rev.aspects) {
      const aspWeight =
        asp.sentiment === 'POSITIVE'
          ? TASTE_CONFIG.WEIGHTS.POSITIVE_REVIEW_ASPECT_WEIGHT * decay
          : asp.sentiment === 'NEGATIVE'
          ? TASTE_CONFIG.WEIGHTS.NEGATIVE_REVIEW_ASPECT_WEIGHT * decay
          : 0;

      if (aspWeight !== 0) {
        addSignal(aspectAcc, asp.aspect, aspWeight, `Review feedback on ${asp.aspect} for "${title}"`);
      }
    }
  }

  // --- PASS 5: Explicit Recommendation Feedback ---
  for (const fb of explicitFeedback) {
    const decay = calculateTimeDecay(fb.createdAt);
    let fbWeight = 0;
    if (fb.feedback === 'MORE_LIKE_THIS') fbWeight = TASTE_CONFIG.WEIGHTS.FEEDBACK_MORE_LIKE_THIS * decay;
    else if (fb.feedback === 'LESS_LIKE_THIS') fbWeight = TASTE_CONFIG.WEIGHTS.FEEDBACK_LESS_LIKE_THIS * decay;
    else if (fb.feedback === 'NOT_INTERESTED') fbWeight = TASTE_CONFIG.WEIGHTS.FEEDBACK_NOT_INTERESTED * decay;

    if (fbWeight !== 0) {
      const title = fb.anime.canonicalTitle;
      fb.anime.animeGenres.forEach((g) => {
        addSignal(genreAcc, g.genre.name, fbWeight, `Marked "${fb.feedback}" on "${title}"`);
      });
      fb.anime.animeThemes.forEach((t) => {
        addSignal(themeAcc, t.theme.name, fbWeight, `Marked "${fb.feedback}" on "${title}"`);
      });
    }
  }

  // Format final signals
  const formatSignals = (
    acc: Record<string, { raw: number; evidence: string[]; count: number }>
  ): Record<string, TasteSignalDetail> => {
    const result: Record<string, TasteSignalDetail> = {};
    for (const [key, val] of Object.entries(acc)) {
      const score = normalizeBounded(val.raw);
      const confidence = parseFloat((1 - Math.exp(-val.count / 3)).toFixed(2));
      result[key] = {
        score,
        confidence,
        evidenceCount: val.count,
        evidence: val.evidence,
      };
    }
    return result;
  };

  const formattedGenres = formatSignals(genreAcc);
  const formattedThemes = formatSignals(themeAcc);
  const formattedStudios = formatSignals(studioAcc);
  const formattedProducers = formatSignals(producerAcc);
  const formattedFormats = formatSignals(formatAcc);
  const formattedLengths = formatSignals(lengthAcc);
  const formattedSeasonality = formatSignals(seasonalityAcc);
  const formattedCreators = formatSignals(creatorAcc);
  const formattedAspects = formatSignals(aspectAcc);

  const topGenres = Object.entries(formattedGenres)
    .filter(([_, d]) => d.score > 0.1)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([name]) => name)
    .slice(0, 5);

  const topThemes = Object.entries(formattedThemes)
    .filter(([_, d]) => d.score > 0.1)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([name]) => name)
    .slice(0, 5);

  const topStudios = Object.entries(formattedStudios)
    .filter(([_, d]) => d.score > 0.1)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([name]) => name)
    .slice(0, 5);

  const topFormats = Object.entries(formattedFormats)
    .filter(([_, d]) => d.score > 0.1)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([name]) => name)
    .slice(0, 3);

  const topLengths = Object.entries(formattedLengths)
    .filter(([_, d]) => d.score > 0.1)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([name]) => name)
    .slice(0, 2);

  const confidenceTier: 'COLD_START' | 'LOW_CONFIDENCE' | 'LEARNING' | 'ESTABLISHED' =
    totalSignalCount === 0
      ? 'COLD_START'
      : totalSignalCount < 5
      ? 'LOW_CONFIDENCE'
      : totalSignalCount < 15
      ? 'LEARNING'
      : 'ESTABLISHED';

  const overallConfidence = parseFloat((1 - Math.exp(-totalSignalCount / 10)).toFixed(2));

  // Generate plain language insights
  const userFacingInsights: string[] = [];
  if (topGenres.length > 0) {
    userFacingInsights.push(`Your taste strongly leans toward ${topGenres.slice(0, 2).join(' & ')}.`);
  }
  if (topStudios.length > 0) {
    userFacingInsights.push(`You consistently rate works by Studio ${topStudios[0]} highly.`);
  }
  if (formattedAspects.STORY && formattedAspects.STORY.score > 0.4) {
    userFacingInsights.push('Story and narrative depth are essential elements in your favorite titles.');
  }

  // Persist Profile to SQLite Database
  const profile = await prisma.userTasteProfile.upsert({
    where: { userId },
    update: {
      profileVersion: TASTE_ENGINE_VERSION,
      confidenceTier,
      overallConfidence,
      totalSignalsCount: totalSignalCount,
      topGenresJson: JSON.stringify(topGenres),
      topThemesJson: JSON.stringify(topThemes),
      topStudiosJson: JSON.stringify(topStudios),
      aspectProfileJson: JSON.stringify(formattedAspects),
      shortTermProfileJson: JSON.stringify({ genres: shortTermGenres, themes: shortTermThemes, studios: shortTermStudios }),
      formatPreferencesJson: JSON.stringify(formattedFormats),
      lengthPreferencesJson: JSON.stringify(formattedLengths),
      seasonalityPreferencesJson: JSON.stringify(formattedSeasonality),
      creatorPreferencesJson: JSON.stringify(formattedCreators),
      derivedExplanationsJson: JSON.stringify(userFacingInsights),
      updatedAt: new Date(),
    },
    create: {
      userId,
      profileVersion: TASTE_ENGINE_VERSION,
      confidenceTier,
      overallConfidence,
      totalSignalsCount: totalSignalCount,
      topGenresJson: JSON.stringify(topGenres),
      topThemesJson: JSON.stringify(topThemes),
      topStudiosJson: JSON.stringify(topStudios),
      aspectProfileJson: JSON.stringify(formattedAspects),
      shortTermProfileJson: JSON.stringify({ genres: shortTermGenres, themes: shortTermThemes, studios: shortTermStudios }),
      formatPreferencesJson: JSON.stringify(formattedFormats),
      lengthPreferencesJson: JSON.stringify(formattedLengths),
      seasonalityPreferencesJson: JSON.stringify(formattedSeasonality),
      creatorPreferencesJson: JSON.stringify(formattedCreators),
      derivedExplanationsJson: JSON.stringify(userFacingInsights),
    },
  });

  // Persist individual atomic signals to UserTasteSignal table
  const allSignalEntries: { type: string; name: string; detail: TasteSignalDetail }[] = [
    ...Object.entries(formattedGenres).map(([k, v]) => ({ type: 'GENRE', name: k, detail: v })),
    ...Object.entries(formattedThemes).map(([k, v]) => ({ type: 'THEME', name: k, detail: v })),
    ...Object.entries(formattedStudios).map(([k, v]) => ({ type: 'STUDIO', name: k, detail: v })),
    ...Object.entries(formattedAspects).map(([k, v]) => ({ type: 'ASPECT', name: k, detail: v })),
    ...Object.entries(formattedFormats).map(([k, v]) => ({ type: 'FORMAT', name: k, detail: v })),
  ];

  for (const s of allSignalEntries) {
    await prisma.userTasteSignal.upsert({
      where: {
        profileId_signalType_targetName: {
          profileId: profile.id,
          signalType: s.type,
          targetName: s.name,
        },
      },
      update: {
        preferenceScore: s.detail.score,
        confidenceScore: s.detail.confidence,
        evidenceCount: s.detail.evidenceCount,
        evidenceJson: JSON.stringify(s.detail.evidence),
        lastUpdated: new Date(),
      },
      create: {
        profileId: profile.id,
        signalType: s.type,
        targetName: s.name,
        preferenceScore: s.detail.score,
        confidenceScore: s.detail.confidence,
        evidenceCount: s.detail.evidenceCount,
        evidenceJson: JSON.stringify(s.detail.evidence),
      },
    }).catch(() => {});
  }

  const genreAffinities = Object.entries(formattedGenres).map(([k, v]) => ({ name: k, score: v.score }));
  const themeAffinities = Object.entries(formattedThemes).map(([k, v]) => ({ name: k, score: v.score }));
  const studioAffinities = Object.entries(formattedStudios).map(([k, v]) => ({ name: k, score: v.score }));

  return {
    userId,
    profileVersion: TASTE_ENGINE_VERSION,
    confidenceTier,
    overallConfidence,
    totalSignalsCount: totalSignalCount,
    genres: formattedGenres,
    themes: formattedThemes,
    studios: formattedStudios,
    producers: formattedProducers,
    formats: formattedFormats,
    lengths: formattedLengths,
    seasonality: formattedSeasonality,
    creators: formattedCreators,
    aspects: formattedAspects,
    shortTerm: {
      genres: shortTermGenres,
      themes: shortTermThemes,
      studios: shortTermStudios,
    },
    genreAffinities,
    themeAffinities,
    studioAffinities,
    topGenres,
    topThemes,
    topStudios,
    topFormats,
    topLengths,
    userFacingInsights,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Retrieves user taste profile with cached fast read
 */
export async function getUserTasteProfile(userId: string): Promise<UserTasteProfileResult> {
  const profile = await prisma.userTasteProfile.findUnique({
    where: { userId },
    include: { signals: true },
  });

  if (!profile) {
    return await rebuildTasteProfile(userId);
  }

  const genres: Record<string, TasteSignalDetail> = {};
  const themes: Record<string, TasteSignalDetail> = {};
  const studios: Record<string, TasteSignalDetail> = {};
  const producers: Record<string, TasteSignalDetail> = {};
  const formats: Record<string, TasteSignalDetail> = {};
  const lengths: Record<string, TasteSignalDetail> = {};
  const seasonality: Record<string, TasteSignalDetail> = {};
  const creators: Record<string, TasteSignalDetail> = {};
  const aspects: Record<string, TasteSignalDetail> = {};

  profile.signals.forEach((s) => {
    const detail: TasteSignalDetail = {
      score: s.preferenceScore,
      confidence: s.confidenceScore,
      evidenceCount: s.evidenceCount,
      evidence: s.evidenceJson ? JSON.parse(s.evidenceJson) : [],
    };
    if (s.signalType === 'GENRE') genres[s.targetName] = detail;
    else if (s.signalType === 'THEME') themes[s.targetName] = detail;
    else if (s.signalType === 'STUDIO') studios[s.targetName] = detail;
    else if (s.signalType === 'PRODUCER') producers[s.targetName] = detail;
    else if (s.signalType === 'FORMAT') formats[s.targetName] = detail;
    else if (s.signalType === 'LENGTH') lengths[s.targetName] = detail;
    else if (s.signalType === 'CREATOR') creators[s.targetName] = detail;
    else if (s.signalType === 'ASPECT') aspects[s.targetName] = detail;
  });

  const topGenres: string[] = profile.topGenresJson ? JSON.parse(profile.topGenresJson) : [];
  const topThemes: string[] = profile.topThemesJson ? JSON.parse(profile.topThemesJson) : [];
  const topStudios: string[] = profile.topStudiosJson ? JSON.parse(profile.topStudiosJson) : [];
  const topFormats: string[] = profile.formatPreferencesJson ? Object.keys(JSON.parse(profile.formatPreferencesJson)).slice(0, 3) : [];
  const topLengths: string[] = profile.lengthPreferencesJson ? Object.keys(JSON.parse(profile.lengthPreferencesJson)).slice(0, 2) : [];
  const userFacingInsights: string[] = profile.derivedExplanationsJson ? JSON.parse(profile.derivedExplanationsJson) : [];
  const shortTerm = profile.shortTermProfileJson ? JSON.parse(profile.shortTermProfileJson) : { genres: {}, themes: {}, studios: {} };

  const genreAffinities = Object.entries(genres).map(([k, v]) => ({ name: k, score: v.score }));
  const themeAffinities = Object.entries(themes).map(([k, v]) => ({ name: k, score: v.score }));
  const studioAffinities = Object.entries(studios).map(([k, v]) => ({ name: k, score: v.score }));

  return {
    userId,
    profileVersion: profile.profileVersion,
    confidenceTier: profile.confidenceTier as any,
    overallConfidence: profile.overallConfidence,
    totalSignalsCount: profile.totalSignalsCount,
    genres,
    themes,
    studios,
    producers,
    formats,
    lengths,
    seasonality,
    creators,
    aspects,
    shortTerm,
    genreAffinities,
    themeAffinities,
    studioAffinities,
    topGenres,
    topThemes,
    topStudios,
    topFormats,
    topLengths,
    userFacingInsights,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/**
 * Resets user's derived personalization state without deleting ratings, watch progress or bookmarks
 */
export async function resetUserTasteProfile(userId: string): Promise<{ success: boolean; message: string }> {
  await prisma.$transaction([
    prisma.userTasteSignal.deleteMany({ where: { profile: { userId } } }),
    prisma.userTasteProfile.deleteMany({ where: { userId } }),
    prisma.recommendationFeedback.deleteMany({ where: { userId } }),
    prisma.recommendationSession.deleteMany({ where: { userId } }),
  ]);

  return {
    success: true,
    message: 'User personalization profile and derived recommendation caches have been reset.',
  };
}

/**
 * Batch backfill all active users
 */
export async function backfillAllUserProfiles(): Promise<{ processedCount: number }> {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    await rebuildTasteProfile(u.id).catch((err) => {
      console.error(`[TasteEngine] Failed to backfill taste for user ${u.id}:`, err);
    });
  }
  return { processedCount: users.length };
}

export const updateUserTasteProfile = rebuildTasteProfile;
export const calculateUserTasteProfile = rebuildTasteProfile;
export const getUserTaste = getUserTasteProfile;

export const tasteEngine = {
  getUserTasteProfile,
  updateUserTasteProfile,
  rebuildTasteProfile,
  resetUserTasteProfile,
  backfillAllUserProfiles,
};

// Event listeners for automatic background recalculation
registerEventListener('RATING_CREATED', (e) => { if (e.userId) updateUserTasteProfile(e.userId).catch(() => {}); });
registerEventListener('RATING_UPDATED', (e) => { if (e.userId) updateUserTasteProfile(e.userId).catch(() => {}); });
registerEventListener('ANIME_COMPLETED', (e) => { if (e.userId) updateUserTasteProfile(e.userId).catch(() => {}); });
registerEventListener('REVIEW_CREATED', (e) => { if (e.userId) updateUserTasteProfile(e.userId).catch(() => {}); });
registerEventListener('RECOMMENDATION_NOT_INTERESTED', (e) => { if (e.userId) updateUserTasteProfile(e.userId).catch(() => {}); });
registerEventListener('RECOMMENDATION_MORE_LIKE_THIS', (e) => { if (e.userId) updateUserTasteProfile(e.userId).catch(() => {}); });
registerEventListener('RECOMMENDATION_LESS_LIKE_THIS', (e) => { if (e.userId) updateUserTasteProfile(e.userId).catch(() => {}); });
