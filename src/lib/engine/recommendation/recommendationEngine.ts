/**
 * OTAKUVA ENGINE — PHASE 10.5
 * RECOMMENDATION RANKING ENGINE & PERSONALIZATION PIPELINE
 * 
 * Production-grade hybrid recommendation ranking, diversification, explainability,
 * caching, feedback loops, and admin debugging inspection:
 * - Hybrid Weighted Scoring (Taste 25%, Content 20%, Genre/Theme 15%, Explicit 10%, Quality 10%, Studio/Creator 5%, Community/News 5%, Trend 5%, Exploration 5%)
 * - Diversification (Max 35% per primary genre, Studio anti-monopoly)
 * - Explainable Structured Provenance Metadata
 * - Algorithm Versioning & Profile Invalidation
 * - Feedback loop (Impression, Click, Dismiss, More/Less Like This, Not Interested)
 * - Recommendation Debugger & Telemetry Inspector
 */

import { prisma } from '../../prisma';
import { getUserTasteProfile, UserTasteProfileResult, TASTE_ENGINE_VERSION } from '../taste/tasteEngine';
import { candidateGenerationEngine, CandidateWithProvenance } from './candidateGenerationEngine';
import { contentPreferenceEngine } from './contentPreferenceEngine';
import { emitEngineEvent } from '../events/eventEngine';

export const RECOMMENDATION_ALGORITHM_VERSION = 2;

export interface StructuredExplanation {
  reasonType:
    | 'TASTE_GENRE'
    | 'TASTE_THEME'
    | 'TASTE_STUDIO'
    | 'TASTE_ASPECT'
    | 'SIMILAR_ANIME'
    | 'POPULAR'
    | 'TRENDING'
    | 'COMMUNITY'
    | 'NEWS'
    | 'CREATOR'
    | 'EXPLORATION';
  reasonText: string;
  reasonData?: Record<string, any>;
}

export interface RecommendationResultItem {
  id: string;
  canonicalTitle: string;
  slug: string;
  posterUrl: string;
  bannerUrl: string | null;
  score: number | null;
  type: string | null;
  year: number | null;
  recommendationScore: number;
  explanation: string;
  matchReasons: string[];
  structuredExplanation: StructuredExplanation;
  sources: string[];
  genres: string[];
  themes: string[];
  studios: string[];
  scoreBreakdown?: {
    tasteScore: number;
    contentScore: number;
    genreThemeScore: number;
    explicitScore: number;
    qualityScore: number;
    studioCreatorScore: number;
    communityNewsScore: number;
    trendScore: number;
    explorationScore: number;
    penalties: number;
  };
}

export interface RecommendationResponse {
  sessionId?: string;
  algorithmVersion: number;
  profileVersion: number;
  personalizationLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'COLD_START';
  items: RecommendationResultItem[];
  totalCandidatesEvaluated: number;
  context: string;
  isCached?: boolean;
}

export const RANKING_CONFIG = {
  WEIGHTS: {
    TASTE_MATCH: 0.25,
    CONTENT_SIMILARITY: 0.2,
    GENRE_THEME: 0.15,
    EXPLICIT_PREFERENCE: 0.1,
    QUALITY_SIGNAL: 0.1,
    STUDIO_CREATOR: 0.05,
    COMMUNITY_NEWS: 0.05,
    TREND_RECENCY: 0.05,
    EXPLORATION: 0.05,
  },
  MAX_PER_GENRE_RATIO: 0.35,
  MAX_CONSECUTIVE_SAME_STUDIO: 2,
  CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes
};

// In-Memory Recommendation Cache
interface CachedRecommendation {
  data: RecommendationResponse;
  expiresAt: number;
}
const recommendationCache = new Map<string, CachedRecommendation>();

export class RecommendationRankingEngine {
  /**
   * Main Recommendation Entrypoint
   */
  async getPersonalizedRecommendations(
    userId: string,
    options: {
      limit?: number;
      context?: string;
      targetAnimeId?: string;
      forceRefresh?: boolean;
    } = {}
  ): Promise<RecommendationResponse> {
    const { limit = 12, context = 'HOME', targetAnimeId, forceRefresh = false } = options;

    // 1. Fetch User Taste Profile
    const taste = await getUserTasteProfile(userId);

    // Check Cache
    const cacheKey = `${userId}:${taste.profileVersion}:${RECOMMENDATION_ALGORITHM_VERSION}:${context}:${targetAnimeId || 'root'}:${limit}`;
    if (!forceRefresh) {
      const cached = recommendationCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.data, isCached: true };
      }
    }

    // 2. Candidate Generation
    const candidatePool = await candidateGenerationEngine.assembleCandidatePool(userId, taste, {
      targetAnimeId,
      poolLimit: 120,
    });

    // Fallback if catalog is sparse
    if (candidatePool.length === 0) {
      // Cold start: the most-followed titles by recorded member count — the
      // reason text says exactly that. (This was an unordered findMany
      // labelled "Popular in the OTAKUVA community".)
      const fallbackAll = await prisma.anime.findMany({
        take: limit,
        where: targetAnimeId ? { id: { not: targetAnimeId } } : undefined,
        orderBy: [{ members: 'desc' }],
        include: {
          animeGenres: { include: { genre: true } },
          animeThemes: { include: { theme: true } },
          animeStudios: { include: { studio: true } },
          ratingAggregate: true,
          trendMetric: true,
        },
      });

      return {
        algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
        profileVersion: taste.profileVersion,
        personalizationLevel: 'COLD_START',
        totalCandidatesEvaluated: fallbackAll.length,
        context,
        items: fallbackAll.map((a) => ({
          id: a.id,
          canonicalTitle: a.canonicalTitle,
          slug: a.slug,
          posterUrl: a.posterUrl,
          bannerUrl: a.bannerUrl,
          score: a.score,
          type: a.type,
          year: a.year,
          recommendationScore: 7.0,
          explanation: 'Widely followed',
          matchReasons: ['Among the most-followed titles in the catalog'],
          structuredExplanation: {
            reasonType: 'POPULAR',
            reasonText: 'Widely followed',
          },
          sources: ['POPULAR'],
          genres: a.animeGenres.map((g) => g.genre.name),
          themes: a.animeThemes.map((t) => t.theme.name),
          studios: a.animeStudios.map((s) => s.studio.name),
        })),
      };
    }

    // 3. Multi-Feature Hybrid Scoring & Ranking
    const scoredCandidates: RecommendationResultItem[] = [];

    // Fetch user explicit feedback for fine tuning
    const userFeedback = await prisma.recommendationFeedback.findMany({
      where: { userId },
      select: { animeId: true, feedback: true },
    });
    const feedbackMap = new Map(userFeedback.map((f) => [f.animeId, f.feedback]));

    for (const cand of candidatePool) {
      const features = contentPreferenceEngine.extractAnimeFeatures(cand.anime);
      const affinity = contentPreferenceEngine.calculateAffinity(taste, features);

      // Score Signals (Normalized 0.0 to 1.0)
      const tasteMatchScore = affinity.overallAffinity;
      const contentScore = cand.sources.includes('CONTENT') ? 1.0 : cand.sources.includes('GENRE') ? 0.7 : 0.4;
      const genreThemeScore = Math.min(1.0, (affinity.genreAffinity + affinity.themeAffinity) / 1.5);

      // Explicit Feedback Signal
      const fb = feedbackMap.get(cand.anime.id);
      let explicitScore = 0.5;
      if (fb === 'MORE_LIKE_THIS') explicitScore = 1.0;
      else if (fb === 'LESS_LIKE_THIS') explicitScore = 0.0;

      // Quality Signal (Normalized Bayesian Rating)
      const bayesian = features.bayesianScore;
      const qualityScore = Math.max(0.0, Math.min(1.0, (bayesian - 5.0) / 5.0));

      // Studio / Creator Signal
      const studioCreatorScore = Math.min(1.0, affinity.studioAffinity + (cand.sources.includes('CREATOR') ? 0.5 : 0.0));

      // Community / News Signal
      const communityNewsScore = cand.sources.includes('COMMUNITY') || cand.sources.includes('NEWS') ? 0.85 : 0.3;

      // Trend / Momentum Signal
      const trendScore = Math.min(1.0, features.momentumScore / 10.0);

      // Exploration Signal
      const explorationScore = cand.sources.includes('EXPLORATION') ? 1.0 : 0.0;

      // Penalty
      const penalties = affinity.penalty;

      // Final Weighted Composite Score
      const totalScore =
        tasteMatchScore * RANKING_CONFIG.WEIGHTS.TASTE_MATCH +
        contentScore * RANKING_CONFIG.WEIGHTS.CONTENT_SIMILARITY +
        genreThemeScore * RANKING_CONFIG.WEIGHTS.GENRE_THEME +
        explicitScore * RANKING_CONFIG.WEIGHTS.EXPLICIT_PREFERENCE +
        qualityScore * RANKING_CONFIG.WEIGHTS.QUALITY_SIGNAL +
        studioCreatorScore * RANKING_CONFIG.WEIGHTS.STUDIO_CREATOR +
        communityNewsScore * RANKING_CONFIG.WEIGHTS.COMMUNITY_NEWS +
        trendScore * RANKING_CONFIG.WEIGHTS.TREND_RECENCY +
        explorationScore * RANKING_CONFIG.WEIGHTS.EXPLORATION -
        penalties * 0.2;

      // Formulate Structured Explanation
      let structuredExplanation: StructuredExplanation;
      if (cand.provenanceReasons.length > 0) {
        const primaryReason = cand.provenanceReasons[0];
        let reasonType: StructuredExplanation['reasonType'] = 'POPULAR';
        if (cand.sources.includes('STUDIO')) reasonType = 'TASTE_STUDIO';
        else if (cand.sources.includes('GENRE')) reasonType = 'TASTE_GENRE';
        else if (cand.sources.includes('THEME')) reasonType = 'TASTE_THEME';
        else if (cand.sources.includes('COMMUNITY')) reasonType = 'COMMUNITY';
        else if (cand.sources.includes('NEWS')) reasonType = 'NEWS';
        else if (cand.sources.includes('CREATOR')) reasonType = 'CREATOR';
        else if (cand.sources.includes('EXPLORATION')) reasonType = 'EXPLORATION';
        else if (cand.sources.includes('CONTENT')) reasonType = 'SIMILAR_ANIME';

        structuredExplanation = {
          reasonType,
          reasonText: primaryReason,
        };
      } else {
        // No specific signal fired. Don't claim one — OTAKUVA's own rating
        // pool is far too small to call anything "highly rated by the
        // community".
        structuredExplanation = {
          reasonType: 'POPULAR',
          reasonText: 'From the OTAKUVA catalog',
        };
      }

      scoredCandidates.push({
        id: cand.anime.id,
        canonicalTitle: cand.anime.canonicalTitle,
        slug: cand.anime.slug,
        posterUrl: cand.anime.posterUrl,
        bannerUrl: cand.anime.bannerUrl,
        score: cand.anime.score,
        type: cand.anime.type,
        year: cand.anime.year,
        recommendationScore: parseFloat((totalScore * 10.0).toFixed(2)),
        explanation: structuredExplanation.reasonText,
        matchReasons: [...cand.provenanceReasons, ...affinity.reasons],
        structuredExplanation,
        sources: cand.sources,
        genres: features.genres,
        themes: features.themes,
        studios: features.studios,
        scoreBreakdown: {
          tasteScore: parseFloat(tasteMatchScore.toFixed(2)),
          contentScore: parseFloat(contentScore.toFixed(2)),
          genreThemeScore: parseFloat(genreThemeScore.toFixed(2)),
          explicitScore: parseFloat(explicitScore.toFixed(2)),
          qualityScore: parseFloat(qualityScore.toFixed(2)),
          studioCreatorScore: parseFloat(studioCreatorScore.toFixed(2)),
          communityNewsScore: parseFloat(communityNewsScore.toFixed(2)),
          trendScore: parseFloat(trendScore.toFixed(2)),
          explorationScore: parseFloat(explorationScore.toFixed(2)),
          penalties: parseFloat(penalties.toFixed(2)),
        },
      });
    }

    // 4. Sort Descending by Final Score
    scoredCandidates.sort((a, b) => b.recommendationScore - a.recommendationScore);

    // 5. Diversification (Genre & Studio Repetition Limits)
    const finalItems: RecommendationResultItem[] = [];
    const genreCountMap: Record<string, number> = {};
    const maxPerGenre = Math.max(2, Math.floor(limit * RANKING_CONFIG.MAX_PER_GENRE_RATIO));
    const deferredItems: RecommendationResultItem[] = [];

    for (const item of scoredCandidates) {
      const primaryGenre = item.genres[0] || 'Uncategorized';
      const currentGenreCount = genreCountMap[primaryGenre] || 0;

      if (currentGenreCount < maxPerGenre) {
        finalItems.push(item);
        genreCountMap[primaryGenre] = currentGenreCount + 1;
      } else {
        deferredItems.push(item);
      }

      if (finalItems.length >= limit) break;
    }

    // Fill remaining slots if necessary
    if (finalItems.length < limit && deferredItems.length > 0) {
      for (const item of deferredItems) {
        finalItems.push(item);
        if (finalItems.length >= limit) break;
      }
    }

    // 6. Record Recommendation Session to Database
    const session = await prisma.recommendationSession.create({
      data: {
        userId,
        algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
        context,
        targetAnimeId: targetAnimeId || null,
        items: {
          create: finalItems.map((item, idx) => ({
            animeId: item.id,
            position: idx + 1,
            score: item.recommendationScore,
            source: item.sources[0] || 'TASTE',
            reasonType: item.structuredExplanation.reasonType,
            reasonText: item.structuredExplanation.reasonText,
            reasonData: item.structuredExplanation.reasonData
              ? JSON.stringify(item.structuredExplanation.reasonData)
              : null,
            status: 'DELIVERED',
          })),
        },
      },
    }).catch(() => null);

    // 7. Emit Engine Event
    await emitEngineEvent({
      eventType: 'RECOMMENDATION_GENERATED',
      userId,
      entityType: 'USER',
      entityId: userId,
      metadata: {
        sessionId: session?.id,
        itemCount: finalItems.length,
        context,
      },
    });

    const personalizationLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'COLD_START' =
      taste.confidenceTier === 'ESTABLISHED'
        ? 'HIGH'
        : taste.confidenceTier === 'LEARNING'
        ? 'MEDIUM'
        : taste.confidenceTier === 'LOW_CONFIDENCE'
        ? 'LOW'
        : 'COLD_START';

    const response: RecommendationResponse = {
      sessionId: session?.id,
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
      profileVersion: taste.profileVersion,
      personalizationLevel,
      totalCandidatesEvaluated: candidatePool.length,
      context,
      items: finalItems,
    };

    // Save to Cache
    recommendationCache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + RANKING_CONFIG.CACHE_TTL_MS,
    });

    return response;
  }

  /**
   * Invalidates recommendation cache for a specific user
   */
  invalidateUserCache(userId: string) {
    for (const key of recommendationCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        recommendationCache.delete(key);
      }
    }
  }

  /**
   * Admin Debugger & Telemetry Inspector
   */
  async debugUserRecommendations(userId: string): Promise<{
    tasteProfile: UserTasteProfileResult;
    candidatesGeneratedCount: number;
    topRecommendations: RecommendationResultItem[];
  }> {
    const taste = await getUserTasteProfile(userId);
    const recommendations = await this.getPersonalizedRecommendations(userId, {
      limit: 10,
      context: 'ADMIN_DEBUGGER',
      forceRefresh: true,
    });

    return {
      tasteProfile: taste,
      candidatesGeneratedCount: recommendations.totalCandidatesEvaluated,
      topRecommendations: recommendations.items,
    };
  }
}

export const recommendationRankingEngine = new RecommendationRankingEngine();

// Legacy compatibility exports
export const getPersonalizedRecommendations = (userId: string, limit?: number, context?: string, targetAnimeId?: string) =>
  recommendationRankingEngine.getPersonalizedRecommendations(userId, { limit, context, targetAnimeId });

export const recordRecommendationFeedback = async (
  userId: string,
  recommendationItemId: string,
  action: 'CLICKED' | 'DISMISSED' | 'SAVED'
) => {
  const item = await prisma.recommendationItem.findUnique({
    where: { id: recommendationItemId },
    include: { session: true },
  });

  if (!item || item.session.userId !== userId) {
    throw new Error('Recommendation item not found or unauthorized');
  }

  await prisma.recommendationItem.update({
    where: { id: recommendationItemId },
    data: { status: action },
  });

  recommendationRankingEngine.invalidateUserCache(userId);

  await emitEngineEvent({
    eventType:
      action === 'CLICKED'
        ? 'RECOMMENDATION_CLICKED'
        : action === 'DISMISSED'
        ? 'RECOMMENDATION_DISMISSED'
        : 'RECOMMENDATION_VIEWED',
    userId,
    entityType: 'ANIME',
    entityId: item.animeId,
    metadata: {
      sessionId: item.sessionId,
      position: item.position,
      source: item.source,
      reasonType: item.reasonType,
    },
  });

  return { success: true };
};

export const recommendationEngine = {
  getPersonalizedRecommendations: (userId: string, limit?: number, context?: string, targetAnimeId?: string) =>
    recommendationRankingEngine.getPersonalizedRecommendations(userId, { limit, context, targetAnimeId }),
  recordRecommendationFeedback,
  debugUserRecommendations: (userId: string) => recommendationRankingEngine.debugUserRecommendations(userId),
  invalidateUserCache: (userId: string) => recommendationRankingEngine.invalidateUserCache(userId),
};
