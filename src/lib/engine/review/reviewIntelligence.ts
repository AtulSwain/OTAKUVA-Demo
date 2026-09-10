/**
 * OTAKUVA REVIEW & REVIEW INTELLIGENCE ENGINE
 * Manages full review lifecycle (Anime & Episode reviews, edits, deletions, reactions, reports, spoilers)
 * and asynchronous NLP sentiment & aspect extraction without ever altering explicit user ratings.
 */

import { prisma } from '../../prisma';
import { emitEngineEvent } from '../events/eventEngine';
export { recalculateAnimeAggregates, validateRatingScore } from '../../rating/ratingService';
import { recalculateAnimeAggregates, validateRatingScore } from '../../rating/ratingService';

export const REVIEW_INTELLIGENCE_VERSION = 1;

export const REVIEW_TAXONOMY = [
  'STORY',
  'PLOT',
  'CHARACTERS',
  'ANIMATION',
  'ART',
  'MUSIC',
  'SOUND',
  'DIRECTION',
  'PACING',
  'WORLD_BUILDING',
  'VOICE_ACTING',
  'ENJOYMENT',
  'EMOTIONAL_IMPACT',
  'ACTION',
  'COMEDY',
  'ROMANCE',
  'MYSTERY',
  'THRILLER',
] as const;

export type ReviewTaxonomyAspect = (typeof REVIEW_TAXONOMY)[number];

export type SpoilerLevelType = 'SPOILER_FREE' | 'MILD_SPOILERS' | 'SPOILERS' | 'FULL_SPOILERS';

export interface ExtractedAspect {
  aspect: string;
  sentiment: 'POSITIVE' | 'MIXED' | 'NEGATIVE' | 'NEUTRAL';
  sentimentScore: number; // -1.0 to 1.0
  confidence: number;
  snippet?: string;
}

export interface IngestReviewInput {
  userId: string;
  animeId: string;
  episodeId?: string;
  episodeNumber?: number;
  seasonId?: string;
  reviewType?: 'ANIME_REVIEW' | 'EPISODE_REVIEW' | 'SEASON_REVIEW';
  title: string;
  body: string;
  rating?: number | null; // 0.5 to 10.0 in 0.5 increments, or null
  containsSpoiler?: boolean;
  spoilerLevel?: SpoilerLevelType;
  watchStatusAtReview?: string | null;
  episodeProgressAtReview?: number | null;
}

export interface UpdateReviewInput {
  userId: string;
  reviewId: string;
  title?: string;
  body?: string;
  rating?: number | null;
  containsSpoiler?: boolean;
  spoilerLevel?: SpoilerLevelType;
  watchStatusAtReview?: string | null;
  episodeProgressAtReview?: number | null;
}

const UNIVERSAL_POSITIVE = ['masterpiece', 'brilliant', 'compelling', 'gripping', 'deep', 'well-written', 'emotional', 'satisfying', 'great', 'amazing', 'loved', 'excellent', 'superb', 'fantastic', 'top-tier', 'incredible', 'favorite'];
const UNIVERSAL_NEGATIVE = ['boring', 'cliché', 'cliche', 'predictable', 'plot hole', 'disappointing', 'weak', 'confusing', 'bad', 'poor', 'terrible', 'awful', 'lackluster', 'subpar', 'mediocre', 'ugly', 'generic'];

// Configurable keyword lexicon for deterministic NLP sentiment extraction
const ASPECT_KEYWORDS: Record<string, { keywords: string[]; positive: string[]; negative: string[] }> = {
  STORY: {
    keywords: ['story', 'narrative', 'writing', 'twist', 'ending', 'premise', 'arc'],
    positive: [...UNIVERSAL_POSITIVE],
    negative: [...UNIVERSAL_NEGATIVE],
  },
  PLOT: {
    keywords: ['plot', 'storyline', 'sub-plot', 'pacing', 'resolution', 'climax'],
    positive: ['engaging', 'intricate', 'coherent', 'thrilling', 'suspenseful', ...UNIVERSAL_POSITIVE],
    negative: ['plothole', 'contrived', 'convoluted', 'nonsensical', 'dull', ...UNIVERSAL_NEGATIVE],
  },
  ANIMATION: {
    keywords: ['animation', 'visuals', 'cgi', 'sakuga', 'motion', 'frames', 'aesthetic'],
    positive: ['fluid', 'gorgeous', 'stunning', 'breathtaking', 'crisp', 'sakuga', 'detailed', 'beautiful', 'clean', 'dynamic', ...UNIVERSAL_POSITIVE],
    negative: ['stiff', 'clunky', 'choppy', 'ugly', 'poor animation', 'lazy', 'bad cgi', 'off-model', 'inconsistent', ...UNIVERSAL_NEGATIVE],
  },
  ART: {
    keywords: ['art', 'art style', 'character design', 'backgrounds', 'coloring', 'scenery'],
    positive: ['gorgeous art', 'stunning background', 'vibrant', 'lush', 'expressive', 'detailed art', ...UNIVERSAL_POSITIVE],
    negative: ['bland art', 'ugly designs', 'low budget', 'sloppy', ...UNIVERSAL_NEGATIVE],
  },
  CHARACTERS: {
    keywords: ['character', 'protagonist', 'villain', 'cast', 'development', 'hero', 'personality', 'motivation'],
    positive: ['complex', 'compelling', 'iconic', 'deep', 'relatable', 'lovable', 'charismatic', 'well-developed', 'memorable', ...UNIVERSAL_POSITIVE],
    negative: ['flat', 'annoying', 'unlikable', 'generic', 'shallow', 'one-dimensional', 'edgy', 'dumb', ...UNIVERSAL_NEGATIVE],
  },
  MUSIC: {
    keywords: ['music', 'soundtrack', 'ost', 'opening', 'ending', 'score', 'sound design', 'theme song', 'op', 'ed'],
    positive: ['masterpiece', 'haunting', 'epic', 'catchy', 'emotional', 'hype', 'unforgettable', 'banger', 'masterful', ...UNIVERSAL_POSITIVE],
    negative: ['forgettable', 'jarring', 'repetitive', 'dull', 'annoying', 'generic soundtrack', ...UNIVERSAL_NEGATIVE],
  },
  SOUND: {
    keywords: ['sound', 'sfx', 'audio', 'foley', 'sound effect'],
    positive: ['crisp sound', 'impactful sfx', 'immersive audio', 'great sound', ...UNIVERSAL_POSITIVE],
    negative: ['muffled', 'poor mixing', 'jarring audio', ...UNIVERSAL_NEGATIVE],
  },
  DIRECTION: {
    keywords: ['direction', 'director', 'cinematography', 'framing', 'atmosphere', 'tone', 'shot composition'],
    positive: ['masterful', 'visionary', 'tense', 'atmospheric', 'stylish', 'impactful', 'brilliant direction', ...UNIVERSAL_POSITIVE],
    negative: ['pretentious', 'aimless', 'flat direction', 'bland', 'messy', ...UNIVERSAL_NEGATIVE],
  },
  PACING: {
    keywords: ['pacing', 'speed', 'flow', 'dragged', 'rushed', 'episodes felt'],
    positive: ['perfect pacing', 'hooked', 'breezy', 'well-paced', 'flawless flow', ...UNIVERSAL_POSITIVE],
    negative: ['dragged', 'slow', 'boring', 'rushed', 'uneven', 'filler', ...UNIVERSAL_NEGATIVE],
  },
  WORLD_BUILDING: {
    keywords: ['world', 'lore', 'setting', 'universe', 'magic system', 'mythology'],
    positive: ['rich', 'immersive', 'fascinating', 'detailed', 'expansive', 'intriguing lore', ...UNIVERSAL_POSITIVE],
    negative: ['generic', 'bland setting', 'unexplained', 'inconsistent world', 'shallow lore', ...UNIVERSAL_NEGATIVE],
  },
  VOICE_ACTING: {
    keywords: ['voice', 'seiyuu', 'voice acting', 'dub', 'sub', 'voice actor'],
    positive: ['phenomenal voice', 'passionate acting', 'talented cast', 'convincing', ...UNIVERSAL_POSITIVE],
    negative: ['grating voice', 'wooden acting', 'miscast', 'annoying delivery', ...UNIVERSAL_NEGATIVE],
  },
  ENJOYMENT: {
    keywords: ['enjoyment', 'experience', 'fun', 'entertaining', 'recommend', 'overall'],
    positive: ['enjoyed', 'loved', 'must watch', 'fun', 'entertaining', 'favorite', '10/10', 'hooked', ...UNIVERSAL_POSITIVE],
    negative: ['waste of time', 'regret', 'dropped', 'hated', 'boring', 'could not finish', ...UNIVERSAL_NEGATIVE],
  },
};

/**
 * Lightweight language detection helper
 */
export function detectLanguage(text: string): { language: string; confidence: number } {
  // Simple deterministic heuristic for English, Japanese, and others
  const jaRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
  if (jaRegex.test(text)) {
    return { language: 'ja', confidence: 0.95 };
  }
  return { language: 'en', confidence: 0.98 };
}

/**
 * Extracts structured aspect sentiments from review text using NLP classification
 */
export function extractAspectSentiments(body: string, rating?: number | null): ExtractedAspect[] {
  const lower = body.toLowerCase();
  const sentences = lower
    .split(/[.!?;,\n]+|\b(?:but|however|although|though|whereas|while|yet)\b/i)
    .filter((s) => s.trim().length > 2);
  const extracted: ExtractedAspect[] = [];

  for (const aspect of REVIEW_TAXONOMY) {
    const config = ASPECT_KEYWORDS[aspect];
    if (!config) continue;

    let aspectFound = false;
    let posCount = 0;
    let negCount = 0;
    let sampleSnippet = '';

    for (const sentence of sentences) {
      const mentionsAspect = config.keywords.some((kw) => sentence.includes(kw));
      if (mentionsAspect) {
        aspectFound = true;
        if (!sampleSnippet) sampleSnippet = sentence.trim();

        config.positive.forEach((pw) => {
          if (sentence.includes(pw)) posCount++;
        });
        config.negative.forEach((nw) => {
          if (sentence.includes(nw)) negCount++;
        });
      }
    }

    if (aspectFound || (aspect === 'ENJOYMENT' && body.length > 20)) {
      let sentiment: 'POSITIVE' | 'MIXED' | 'NEGATIVE' = 'POSITIVE';
      let score = 0.5;

      if (posCount > 0 && negCount > 0) {
        sentiment = 'MIXED';
        score = (posCount - negCount) / (posCount + negCount);
      } else if (negCount > posCount) {
        sentiment = 'NEGATIVE';
        score = -0.7;
      } else if (posCount > 0) {
        sentiment = 'POSITIVE';
        score = 0.8;
      } else {
        // Fall back to rating baseline for this aspect if rating provided
        const effectiveRating = typeof rating === 'number' && !isNaN(rating) ? rating : 7.5;
        score = (effectiveRating - 5) / 5;
        sentiment = score >= 0.3 ? 'POSITIVE' : score <= -0.3 ? 'NEGATIVE' : 'MIXED';
      }

      extracted.push({
        aspect,
        sentiment,
        sentimentScore: parseFloat(score.toFixed(2)),
        confidence: aspectFound ? 0.9 : 0.65,
        snippet: sampleSnippet || undefined,
      });
    }
  }

  return extracted;
}

/**
 * Creates or upserts and analyzes a review
 */
export async function createAndAnalyzeReview(input: IngestReviewInput) {
  const {
    userId,
    animeId,
    episodeId,
    episodeNumber,
    seasonId,
    reviewType = 'ANIME_REVIEW',
    title,
    body,
    rating = null,
    containsSpoiler = false,
    spoilerLevel,
    watchStatusAtReview,
    episodeProgressAtReview,
  } = input;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    select: { id: true, canonicalTitle: true },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const resolvedAnimeId = anime.id;
  let resolvedEpisodeId = episodeId;

  // If episodeNumber supplied but not episodeId, resolve episode
  if (!resolvedEpisodeId && episodeNumber !== undefined) {
    let ep = await prisma.episode.findFirst({
      where: { animeId: resolvedAnimeId, number: episodeNumber },
    });
    if (!ep) {
      ep = await prisma.episode.create({
        data: {
          animeId: resolvedAnimeId,
          number: episodeNumber,
          title: `Episode ${episodeNumber}`,
        },
      });
    }
    resolvedEpisodeId = ep.id;
  }

  // Validate rating if provided (0.5 to 10.0, 0.5 step, or null)
  let cleanRating: number | null = null;
  if (typeof rating === 'number' && !isNaN(rating)) {
    const val = validateRatingScore(rating);
    if (!val.valid) {
      throw new Error(val.error);
    }
    cleanRating = val.normalized;
  }

  // Determine spoilerLevel and containsSpoiler
  const resolvedSpoilerLevel: SpoilerLevelType =
    spoilerLevel || (containsSpoiler ? 'SPOILERS' : 'SPOILER_FREE');
  const hasSpoiler = resolvedSpoilerLevel !== 'SPOILER_FREE';

  const langInfo = detectLanguage(body);
  const extractedAspects = extractAspectSentiments(body, cleanRating);

  // Overall sentiment calculation
  const avgAspectScore =
    extractedAspects.length > 0
      ? extractedAspects.reduce((acc, a) => acc + a.sentimentScore, 0) / extractedAspects.length
      : cleanRating !== null
      ? (cleanRating - 5) / 5
      : 0.2;

  const overallSentiment =
    avgAspectScore >= 0.3 ? 'POSITIVE' : avgAspectScore <= -0.3 ? 'NEGATIVE' : 'MIXED';

  const review = await prisma.$transaction(async (tx) => {
    // Check if review already exists for this (userId, animeId)
    const existingReview = await tx.review.findUnique({
      where: { userId_animeId: { userId, animeId: resolvedAnimeId } },
    });

    let targetReview;

    if (existingReview) {
      targetReview = await tx.review.update({
        where: { id: existingReview.id },
        data: {
          title: title.trim(),
          body: body.trim(),
          rating: cleanRating !== null ? cleanRating : existingReview.rating,
          containsSpoiler: hasSpoiler,
          spoilerLevel: resolvedSpoilerLevel,
          watchStatusAtReview: watchStatusAtReview ?? existingReview.watchStatusAtReview,
          episodeProgressAtReview: episodeProgressAtReview ?? existingReview.episodeProgressAtReview,
          status: 'PUBLISHED',
          deletedAt: null,
          edited: true,
          language: langInfo.language,
          languageConfidence: langInfo.confidence,
          overallSentiment,
          updatedAt: new Date(),
        },
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
      });
      await tx.reviewAspect.deleteMany({ where: { reviewId: targetReview.id } });
    } else {
      targetReview = await tx.review.create({
        data: {
          userId,
          animeId: resolvedAnimeId,
          episodeId: resolvedEpisodeId || null,
          seasonId: seasonId || null,
          reviewType: resolvedEpisodeId ? 'EPISODE_REVIEW' : reviewType,
          title: title.trim(),
          body: body.trim(),
          rating: cleanRating,
          containsSpoiler: hasSpoiler,
          spoilerLevel: resolvedSpoilerLevel,
          watchStatusAtReview: watchStatusAtReview || null,
          episodeProgressAtReview: episodeProgressAtReview ?? null,
          language: langInfo.language,
          languageConfidence: langInfo.confidence,
          overallSentiment,
          sentimentConfidence: 0.9,
          analysisModelVersion: REVIEW_INTELLIGENCE_VERSION,
          analysisStatus: 'COMPLETED',
        },
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
      });
    }

    if (extractedAspects.length > 0) {
      await tx.reviewAspect.createMany({
        data: extractedAspects.map((a) => ({
          reviewId: targetReview.id,
          aspect: a.aspect,
          sentiment: a.sentiment,
          sentimentScore: a.sentimentScore,
          confidence: a.confidence,
          snippetsJson: a.snippet ? JSON.stringify([a.snippet]) : null,
        })),
      });
    }

    return targetReview;
  });

  // Non-blocking Community Opinion & Rating aggregates recalculation
  recalculateCommunityOpinion(resolvedAnimeId).catch(() => {});
  recalculateAnimeAggregates(resolvedAnimeId).catch(() => {});

  // Emit event
  await emitEngineEvent({
    eventType: 'REVIEW_CREATED',
    userId,
    entityType: 'REVIEW',
    entityId: review.id,
    metadata: {
      animeId: resolvedAnimeId,
      rating: cleanRating,
      aspects: extractedAspects.map((a) => a.aspect),
    },
  });

  return { review, extractedAspects };
}

/**
 * Updates a user review
 */
export async function updateReview(input: UpdateReviewInput) {
  const {
    userId,
    reviewId,
    title,
    body,
    rating,
    containsSpoiler,
    spoilerLevel,
    watchStatusAtReview,
    episodeProgressAtReview,
  } = input;

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!existing || existing.deletedAt) {
    throw new Error('Review not found');
  }

  if (existing.userId !== userId) {
    throw new Error('Unauthorized to edit this review');
  }

  const updatedBody = body !== undefined ? body.trim() : existing.body;

  let cleanRating: number | null = existing.rating;
  if (rating !== undefined) {
    if (rating === null) {
      cleanRating = null;
    } else {
      const val = validateRatingScore(rating);
      if (!val.valid) throw new Error(val.error);
      cleanRating = val.normalized;
    }
  }

  const resolvedSpoilerLevel: SpoilerLevelType =
    spoilerLevel ||
    (containsSpoiler !== undefined
      ? containsSpoiler
        ? 'SPOILERS'
        : 'SPOILER_FREE'
      : (existing.spoilerLevel as SpoilerLevelType) || 'SPOILER_FREE');
  const hasSpoiler = resolvedSpoilerLevel !== 'SPOILER_FREE';

  const extractedAspects = extractAspectSentiments(updatedBody, cleanRating);

  const updated = await prisma.$transaction(async (tx) => {
    const rev = await tx.review.update({
      where: { id: reviewId },
      data: {
        title: title !== undefined ? title.trim() : existing.title,
        body: updatedBody,
        rating: cleanRating,
        containsSpoiler: hasSpoiler,
        spoilerLevel: resolvedSpoilerLevel,
        watchStatusAtReview: watchStatusAtReview !== undefined ? watchStatusAtReview : existing.watchStatusAtReview,
        episodeProgressAtReview: episodeProgressAtReview !== undefined ? episodeProgressAtReview : existing.episodeProgressAtReview,
        edited: true,
        updatedAt: new Date(),
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    await tx.reviewAspect.deleteMany({ where: { reviewId } });
    if (extractedAspects.length > 0) {
      await tx.reviewAspect.createMany({
        data: extractedAspects.map((a) => ({
          reviewId,
          aspect: a.aspect,
          sentiment: a.sentiment,
          sentimentScore: a.sentimentScore,
          confidence: a.confidence,
          snippetsJson: a.snippet ? JSON.stringify([a.snippet]) : null,
        })),
      });
    }

    return rev;
  });

  recalculateCommunityOpinion(existing.animeId).catch(() => {});
  recalculateAnimeAggregates(existing.animeId).catch(() => {});

  await emitEngineEvent({
    eventType: 'REVIEW_UPDATED',
    userId,
    entityType: 'REVIEW',
    entityId: reviewId,
    metadata: { animeId: existing.animeId, rating: cleanRating },
  });

  return { review: updated, extractedAspects };
}

/**
 * Deletes a review (soft delete or hard delete)
 */
export async function deleteReview(userId: string, reviewId: string, isAdmin: boolean = false) {
  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!existing || existing.deletedAt) {
    throw new Error('Review not found');
  }

  if (existing.userId !== userId && !isAdmin) {
    throw new Error('Unauthorized to delete this review');
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: { deletedAt: new Date(), status: 'DELETED' },
  });

  recalculateCommunityOpinion(existing.animeId).catch(() => {});
  recalculateAnimeAggregates(existing.animeId).catch(() => {});

  await emitEngineEvent({
    eventType: 'REVIEW_DELETED',
    userId,
    entityType: 'REVIEW',
    entityId: reviewId,
    metadata: { animeId: existing.animeId },
  });

  return { success: true };
}

/**
 * Reacts to a review (HELPFUL, LIKE, DISAGREE)
 */
export async function reactToReview(
  userId: string,
  reviewId: string,
  reactionType: 'HELPFUL' | 'LIKE' | 'DISAGREE' = 'HELPFUL'
) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review || review.deletedAt) {
    throw new Error('Review not found');
  }

  const existing = await prisma.reviewLike.findUnique({
    where: {
      reviewId_userId: {
        reviewId,
        userId,
      },
    },
  });

  if (existing) {
    if (existing.reactionType === reactionType) {
      // Toggle off / remove
      await prisma.reviewLike.delete({ where: { id: existing.id } });
      await prisma.review.update({
        where: { id: reviewId },
        data: { likesCount: { decrement: 1 } },
      });

      await emitEngineEvent({
        eventType: 'REVIEW_REACTION_REMOVED',
        userId,
        entityType: 'REVIEW',
        entityId: reviewId,
        metadata: { reactionType },
      });

      return { reacted: false, reactionType: null };
    } else {
      // Update reaction
      await prisma.reviewLike.update({
        where: { id: existing.id },
        data: { reactionType },
      });
      return { reacted: true, reactionType };
    }
  } else {
    // Add reaction
    await prisma.reviewLike.create({
      data: {
        reviewId,
        userId,
        reactionType,
      },
    });

    await prisma.review.update({
      where: { id: reviewId },
      data: { likesCount: { increment: 1 } },
    });

    await emitEngineEvent({
      eventType: 'REVIEW_REACTION_ADDED',
      userId,
      entityType: 'REVIEW',
      entityId: reviewId,
      metadata: { reactionType },
    });

    return { reacted: true, reactionType };
  }
}

/**
 * Reports a review for moderation
 */
export async function reportReview(
  userId: string,
  reviewId: string,
  reason: 'SPAM' | 'HARASSMENT' | 'SPOILER' | 'HATEFUL_CONTENT' | 'MISINFORMATION' | 'OTHER',
  details?: string
) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review || review.deletedAt) {
    throw new Error('Review not found');
  }

  const report = await prisma.reviewReport.upsert({
    where: {
      reviewId_userId: {
        reviewId,
        userId,
      },
    },
    update: {
      reason,
      details,
      status: 'PENDING',
    },
    create: {
      reviewId,
      userId,
      reason,
      details,
      status: 'PENDING',
    },
  });

  await emitEngineEvent({
    eventType: 'REVIEW_REPORTED',
    userId,
    entityType: 'REVIEW',
    entityId: reviewId,
    metadata: { reason },
  });

  return report;
}

/**
 * Recalculates aggregated Community Opinion for an anime
 */
export async function recalculateCommunityOpinion(animeId: string) {
  const aspects = await prisma.reviewAspect.findMany({
    where: {
      review: {
        animeId,
        deletedAt: null,
        status: 'PUBLISHED',
      },
    },
  });

  const totalReviews = await prisma.review.count({
    where: {
      animeId,
      deletedAt: null,
      status: 'PUBLISHED',
    },
  });

  if (aspects.length === 0) {
    return null;
  }

  // Calculate sentiment distributions
  let posCount = 0;
  let mixCount = 0;
  let negCount = 0;

  const aspectScores: Record<string, number[]> = {};

  aspects.forEach((a) => {
    if (a.sentiment === 'POSITIVE') posCount++;
    else if (a.sentiment === 'NEGATIVE') negCount++;
    else mixCount++;

    if (!aspectScores[a.aspect]) aspectScores[a.aspect] = [];
    aspectScores[a.aspect].push(a.sentimentScore);
  });

  const totalAspects = aspects.length;
  const positivePercentage = parseFloat(((posCount / totalAspects) * 100).toFixed(1));
  const mixedPercentage = parseFloat(((mixCount / totalAspects) * 100).toFixed(1));
  const negativePercentage = parseFloat(((negCount / totalAspects) * 100).toFixed(1));

  const avgAspect = (asp: string) => {
    const scores = aspectScores[asp];
    if (!scores || scores.length === 0) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Map -1..1 to 0..10
    return parseFloat(((avg + 1) * 5).toFixed(1));
  };

  const praised: string[] = [];
  const criticized: string[] = [];

  for (const [asp, scores] of Object.entries(aspectScores)) {
    if (scores.length >= 2) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg >= 0.5) praised.push(asp);
      else if (avg <= -0.3) criticized.push(asp);
    }
  }

  const overallSentiment =
    positivePercentage >= 60 ? 'POSITIVE' : negativePercentage >= 40 ? 'NEGATIVE' : 'MIXED';

  const confidence =
    totalReviews >= 20 ? 'HIGH' : totalReviews >= 5 ? 'MEDIUM' : totalReviews >= 2 ? 'LOW' : 'EARLY';

  const opinion = await prisma.animeCommunityOpinion.upsert({
    where: { animeId },
    update: {
      overallSentiment,
      storyScore: avgAspect('STORY'),
      animationScore: avgAspect('ANIMATION'),
      charactersScore: avgAspect('CHARACTERS'),
      musicScore: avgAspect('MUSIC'),
      directionScore: avgAspect('DIRECTION'),
      pacingScore: avgAspect('PACING'),
      worldBuildingScore: avgAspect('WORLD_BUILDING'),
      enjoymentScore: avgAspect('ENJOYMENT'),
      positivePercentage,
      mixedPercentage,
      negativePercentage,
      frequentlyPraisedJson: JSON.stringify(praised),
      frequentlyCriticizedJson: JSON.stringify(criticized),
      analyzedReviewCount: totalReviews,
      confidence,
      updatedAt: new Date(),
    },
    create: {
      animeId,
      overallSentiment,
      storyScore: avgAspect('STORY'),
      animationScore: avgAspect('ANIMATION'),
      charactersScore: avgAspect('CHARACTERS'),
      musicScore: avgAspect('MUSIC'),
      directionScore: avgAspect('DIRECTION'),
      pacingScore: avgAspect('PACING'),
      worldBuildingScore: avgAspect('WORLD_BUILDING'),
      enjoymentScore: avgAspect('ENJOYMENT'),
      positivePercentage,
      mixedPercentage,
      negativePercentage,
      frequentlyPraisedJson: JSON.stringify(praised),
      frequentlyCriticizedJson: JSON.stringify(criticized),
      analyzedReviewCount: totalReviews,
      confidence,
    },
  });

  return opinion;
}
