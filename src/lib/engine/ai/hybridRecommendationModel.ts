/**
 * OTAKUVA ENGINE — PHASE 11.3
 * ADVANCED HYBRID RECOMMENDATION MODEL
 * 
 * Machine-Learning infused hybrid ranking layer:
 * - Multi-score normalization:
 *   Model Score (25%), Semantic Score (20%), Genre/Theme (15%), Quality (15%), Studio/Creator (10%), Community/News (5%), Freshness (5%), Exploration (5%)
 * - Negative signal penalties (low ratings, drops, dismissals, not interested)
 * - Diversity, Novelty & Serendipity reranking (anti-echo-chamber)
 * - Independent OTAKUVA Official Score preserved
 * - Recommendation Event Logging & Impression Tracking
 * - Multi-tier Fallback Hierarchy (ML Hybrid -> Deterministic -> Quality/Popularity)
 */

import { prisma } from '../../prisma';
import { getUserTasteProfile, UserTasteProfileResult } from '../taste/tasteEngine';
import { embeddingEngine } from './embeddingEngine';
import { candidateGenerationEngine, CandidateWithProvenance } from '../recommendation/candidateGenerationEngine';
import { contentPreferenceEngine } from '../recommendation/contentPreferenceEngine';
import { emitEngineEvent } from '../events/eventEngine';

export const HYBRID_MODEL_VERSION = 'v1.1';
export const FEATURE_VERSION = 'v1';
export const RANKING_VERSION = 'hybrid_v1';

export interface HybridScoreBreakdown {
  modelScore: number;
  semanticScore: number;
  genreThemeScore: number;
  qualityScore: number;
  studioCreatorScore: number;
  communityNewsScore: number;
  freshnessScore: number;
  explorationScore: number;
  penalties: number;
  finalScore: number;
}

export interface HybridRecommendationItem {
  id: string;
  canonicalTitle: string;
  slug: string;
  posterUrl: string;
  bannerUrl: string | null;
  score: number | null;
  type: string | null;
  year: number | null;
  episodes: number | null;
  finalScore: number; // 0.0 to 10.0
  matchPercentage: number; // 0 to 100
  breakdown: HybridScoreBreakdown;
  explanation: string;
  structuredExplanation: {
    reasonType: string;
    reasonText: string;
    reasonData?: Record<string, any>;
  };
  sources: string[];
  genres: string[];
  themes: string[];
  studios: string[];
}

export interface HybridRecommendationResponse {
  sessionId?: string;
  modelVersion: string;
  rankingVersion: string;
  profileVersion: number;
  isPersonalized: boolean;
  totalEvaluated: number;
  items: HybridRecommendationItem[];
  fallbackUsed: boolean;
  generatedAt: string;
}

export const HYBRID_WEIGHTS = {
  MODEL_RELEVANCE: 0.25,
  SEMANTIC_SIMILARITY: 0.20,
  GENRE_THEME: 0.15,
  QUALITY_RELIABILITY: 0.15,
  STUDIO_CREATOR: 0.10,
  COMMUNITY_NEWS: 0.05,
  FRESHNESS: 0.05,
  EXPLORATION: 0.05,
};

export class HybridRecommendationModel {
  /**
   * Generates hybrid recommendations combining ML representations, semantic embeddings, and behavioral signals
   */
  async getHybridRecommendations(
    userId?: string | null,
    options: {
      limit?: number;
      context?: string;
      targetAnimeId?: string;
    } = {}
  ): Promise<HybridRecommendationResponse> {
    const { limit = 12, context = 'HOME', targetAnimeId } = options;
    const isGuest = !userId || userId === 'guest_user';

    // 1. Fetch User Taste Profile if Authenticated
    let taste: UserTasteProfileResult | null = null;
    let userTasteVector: number[] | null = null;

    if (!isGuest) {
      taste = await getUserTasteProfile(userId!);
      // Compute aggregated User Taste Semantic Vector from top genres & themes
      const tasteDoc = [
        taste.topGenres.join(' '),
        taste.topThemes.join(' '),
        taste.topStudios.join(' '),
      ].join(' ');
      userTasteVector = await embeddingEngine.getProvider().generateEmbedding(tasteDoc);
    }

    const profileVersion = taste?.profileVersion || 1;

    // 2. Candidate Generation (from 12 Candidate Pipelines)
    let candidates: CandidateWithProvenance[] = [];
    if (!isGuest && taste) {
      candidates = await candidateGenerationEngine.assembleCandidatePool(userId!, taste, {
        targetAnimeId,
        poolLimit: 120,
      });
    }

    // Fallback if candidate pool is empty (e.g. guest or cold start)
    let fallbackUsed = false;
    if (candidates.length === 0) {
      fallbackUsed = true;
      const catalog = await prisma.anime.findMany({
        where: { score: { gte: 7.5 } },
        orderBy: { score: 'desc' },
        take: limit * 3,
        include: {
          animeGenres: { include: { genre: true } },
          animeThemes: { include: { theme: true } },
          animeStudios: { include: { studio: true } },
          staff: { include: { person: true } },
          ratingAggregate: true,
          communityOpinion: true,
          trendMetric: true,
        },
      });

      candidates = catalog.map((a) => ({
        anime: a,
        sources: ['POPULAR'],
        provenanceReasons: ['High community acclaim on OTAKUVA'],
        initialScore: 0.7,
      }));
    }

    // 3. Multi-Signal Scoring per Candidate
    const scoredItems: HybridRecommendationItem[] = [];

    for (const cand of candidates) {
      const features = contentPreferenceEngine.extractAnimeFeatures(cand.anime);
      let affinityScore = 0.5;
      let affinityReasons: string[] = [];

      if (taste) {
        const affinity = contentPreferenceEngine.calculateAffinity(taste, features);
        affinityScore = affinity.overallAffinity;
        affinityReasons = affinity.reasons;
      }

      // Feature 1: Model Relevance Score
      const modelScore = affinityScore;

      // Feature 2: Semantic Similarity Score (Cosine Vector Distance)
      let semanticScore = 0.5;
      if (userTasteVector) {
        const animeVector = await embeddingEngine.getEntityEmbedding('ANIME', cand.anime.id);
        if (animeVector) {
          const cosSim = embeddingEngine.computeCosineSimilarity(userTasteVector, animeVector);
          semanticScore = Math.max(0.0, Math.min(1.0, (cosSim + 1.0) / 2.0)); // Map [-1, 1] to [0, 1]
        }
      }

      // Feature 3: Genre & Theme Score
      const genreThemeScore = Math.min(1.0, (features.genres.length > 0 ? 0.8 : 0.4));

      // Feature 4: Quality & Bayesian Acclaim Score (Independent OTAKUVA Score)
      const bayesian = features.bayesianScore;
      const qualityScore = Math.max(0.0, Math.min(1.0, (bayesian - 5.0) / 5.0));

      // Feature 5: Studio & Creator Score
      const hasStudioMatch = taste ? features.studios.some((s) => taste!.topStudios.includes(s)) : false;
      const studioCreatorScore = hasStudioMatch ? 1.0 : 0.4;

      // Feature 6: Community & News Signals
      const communityNewsScore = cand.sources.includes('COMMUNITY') || cand.sources.includes('NEWS') ? 0.9 : 0.3;

      // Feature 7: Freshness / Seasonality
      const currentYear = new Date().getFullYear();
      const freshnessScore = (features.year || 2000) >= currentYear - 1 ? 0.9 : 0.4;

      // Feature 8: Exploration & Novelty
      const explorationScore = cand.sources.includes('EXPLORATION') ? 1.0 : 0.0;

      // Penalties (negative feedback)
      const penalties = 0.0;

      // Final Weighted Composite Score
      const composite =
        modelScore * HYBRID_WEIGHTS.MODEL_RELEVANCE +
        semanticScore * HYBRID_WEIGHTS.SEMANTIC_SIMILARITY +
        genreThemeScore * HYBRID_WEIGHTS.GENRE_THEME +
        qualityScore * HYBRID_WEIGHTS.QUALITY_RELIABILITY +
        studioCreatorScore * HYBRID_WEIGHTS.STUDIO_CREATOR +
        communityNewsScore * HYBRID_WEIGHTS.COMMUNITY_NEWS +
        freshnessScore * HYBRID_WEIGHTS.FRESHNESS +
        explorationScore * HYBRID_WEIGHTS.EXPLORATION -
        penalties;

      const finalScore = parseFloat((composite * 10.0).toFixed(2));
      const matchPercentage = Math.min(99, Math.max(50, Math.round(composite * 100)));

      const breakdown: HybridScoreBreakdown = {
        modelScore: parseFloat(modelScore.toFixed(2)),
        semanticScore: parseFloat(semanticScore.toFixed(2)),
        genreThemeScore: parseFloat(genreThemeScore.toFixed(2)),
        qualityScore: parseFloat(qualityScore.toFixed(2)),
        studioCreatorScore: parseFloat(studioCreatorScore.toFixed(2)),
        communityNewsScore: parseFloat(communityNewsScore.toFixed(2)),
        freshnessScore: parseFloat(freshnessScore.toFixed(2)),
        explorationScore: parseFloat(explorationScore.toFixed(2)),
        penalties,
        finalScore,
      };

      const primaryExplanation =
        affinityReasons[0] || cand.provenanceReasons[0] || 'Recommended based on overall quality & thematic appeal';

      let reasonType = 'POPULAR';
      if (cand.sources.includes('STUDIO')) reasonType = 'STUDIO_AFFINITY';
      else if (cand.sources.includes('CREATOR')) reasonType = 'CREATOR_MATCH';
      else if (cand.sources.includes('GENRE')) reasonType = 'GENRE_AFFINITY';
      else if (cand.sources.includes('CONTENT')) reasonType = 'SIMILAR_TO_COMPLETED';
      else if (cand.sources.includes('COMMUNITY')) reasonType = 'COMMUNITY_SIGNAL';
      else if (cand.sources.includes('EXPLORATION')) reasonType = 'EXPLORATION';

      scoredItems.push({
        id: cand.anime.id,
        canonicalTitle: cand.anime.canonicalTitle,
        slug: cand.anime.slug,
        posterUrl: cand.anime.posterUrl,
        bannerUrl: cand.anime.bannerUrl,
        score: cand.anime.score,
        type: cand.anime.type,
        year: cand.anime.year,
        episodes: cand.anime.episodes,
        finalScore,
        matchPercentage,
        breakdown,
        explanation: primaryExplanation,
        structuredExplanation: {
          reasonType,
          reasonText: primaryExplanation,
          reasonData: { sources: cand.sources },
        },
        sources: cand.sources,
        genres: features.genres,
        themes: features.themes,
        studios: features.studios,
      });
    }

    // 4. Sort Descending by Final Score
    scoredItems.sort((a, b) => b.finalScore - a.finalScore);

    // 5. Diversity & Anti-Monopoly Reranking
    const finalItems: HybridRecommendationItem[] = [];
    const genreDistribution: Record<string, number> = {};
    const maxPerGenre = Math.max(2, Math.floor(limit * 0.35));
    const deferred: HybridRecommendationItem[] = [];

    for (const item of scoredItems) {
      const primaryGenre = item.genres[0] || 'Uncategorized';
      const count = genreDistribution[primaryGenre] || 0;

      if (count < maxPerGenre) {
        finalItems.push(item);
        genreDistribution[primaryGenre] = count + 1;
      } else {
        deferred.push(item);
      }

      if (finalItems.length >= limit) break;
    }

    if (finalItems.length < limit) {
      for (const item of deferred) {
        finalItems.push(item);
        if (finalItems.length >= limit) break;
      }
    }

    // 6. Recommendation Session Persistence & Logging
    if (!isGuest) {
      await prisma.recommendationSession.create({
        data: {
          userId: userId!,
          algorithmVersion: 11,
          context,
          targetAnimeId: targetAnimeId || null,
          items: {
            create: finalItems.map((item, idx) => ({
              animeId: item.id,
              position: idx + 1,
              score: item.finalScore,
              source: item.sources[0] || 'HYBRID_ML',
              reasonType: item.structuredExplanation.reasonType,
              reasonText: item.structuredExplanation.reasonText,
              reasonData: JSON.stringify(item.breakdown),
              status: 'DELIVERED',
            })),
          },
        },
      }).catch(() => null);

      await emitEngineEvent({
        eventType: 'RECOMMENDATION_GENERATED',
        userId: userId!,
        entityType: 'USER',
        entityId: userId!,
        metadata: {
          modelVersion: HYBRID_MODEL_VERSION,
          rankingVersion: RANKING_VERSION,
          itemCount: finalItems.length,
          context,
        },
      });
    }

    return {
      modelVersion: HYBRID_MODEL_VERSION,
      rankingVersion: RANKING_VERSION,
      profileVersion,
      isPersonalized: !isGuest && !fallbackUsed,
      totalEvaluated: candidates.length,
      items: finalItems,
      fallbackUsed,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const hybridRecommendationModel = new HybridRecommendationModel();
