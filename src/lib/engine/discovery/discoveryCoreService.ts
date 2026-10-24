/**
 * OTAKUVA ENGINE — PHASE 10.6 → 10.10
 * OTAKUVA DISCOVERY CORE SERVICE
 * 
 * Centralized recommendation and discovery kernel powering all specialized surfaces:
 * - Surfaces: HOME, SIMILAR_ANIME, STUDIO, CREATOR, COMMUNITY, NEWS
 * - Unified pipeline: Candidate Generation -> Multi-Signal Scoring -> Filtering -> Diversification -> Surface Optimization
 * - Context Engine: Integrates active page, selected anime, studio, community, season, and recent activity
 * - Cross-Surface Cache with profile and algorithm versioning (discovery_v1)
 * - Safe fallback and cold-start handling
 */

import { prisma } from '../../prisma';
import { getUserTasteProfile, UserTasteProfileResult, TASTE_ENGINE_VERSION } from '../taste/tasteEngine';
import { candidateGenerationEngine, CandidateWithProvenance } from '../recommendation/candidateGenerationEngine';
import { contentPreferenceEngine, AnimeFeatureProfile } from '../recommendation/contentPreferenceEngine';
import { emitEngineEvent } from '../events/eventEngine';

export const DISCOVERY_ALGORITHM_VERSION = 1;

export type DiscoverySurface =
  | 'HOME'
  | 'SIMILAR_ANIME'
  | 'STUDIO'
  | 'CREATOR'
  | 'COMMUNITY'
  | 'NEWS';

export interface DiscoveryContext {
  targetAnimeId?: string;
  targetStudioId?: string;
  targetCommunityId?: string;
  targetPersonId?: string;
  targetGenre?: string;
  currentSeason?: string;
  currentYear?: number;
  recentActivityWindowDays?: number;
}

export interface DiscoveryRequestOptions {
  userId?: string | null;
  surface: DiscoverySurface;
  context?: DiscoveryContext;
  limit?: number;
  offset?: number;
  forceRefresh?: boolean;
}

export interface DiscoveryItem {
  id: string;
  canonicalTitle: string;
  slug: string;
  posterUrl: string;
  bannerUrl: string | null;
  score: number | null;
  type: string | null;
  year: number | null;
  episodes: number | null;
  genres: string[];
  themes: string[];
  studios: string[];
  discoveryScore: number;
  matchPercentage?: number;
  explanation: string;
  structuredExplanation: {
    reasonType: string;
    reasonText: string;
    reasonData?: Record<string, any>;
  };
  sources: string[];
  provenance: string[];
}

export interface DiscoveryResponse {
  surface: DiscoverySurface;
  algorithmVersion: number;
  profileVersion: number;
  personalizationTier: 'AUTHENTICATED' | 'COLD_START' | 'GUEST';
  totalEvaluated: number;
  items: DiscoveryItem[];
  context: DiscoveryContext;
  isCached: boolean;
  generatedAt: string;
}

// In-Memory Discovery Kernel Cache
interface CachedDiscoveryResponse {
  data: DiscoveryResponse;
  expiresAt: number;
}
const discoveryCache = new Map<string, CachedDiscoveryResponse>();
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes

export class DiscoveryCoreService {
  /**
   * Centralized Recommendation & Discovery Kernel
   */
  async getRecommendations(options: DiscoveryRequestOptions): Promise<DiscoveryResponse> {
    const {
      userId,
      surface,
      context = {},
      limit = 12,
      forceRefresh = false,
    } = options;

    const isGuest = !userId || userId === 'guest_user';

    // 1. Fetch User Taste Profile if Authenticated
    let taste: UserTasteProfileResult | null = null;
    if (!isGuest) {
      taste = await getUserTasteProfile(userId);
    }

    const profileVersion = taste?.profileVersion || 1;
    const personalizationTier = isGuest
      ? 'GUEST'
      : taste?.confidenceTier === 'COLD_START'
      ? 'COLD_START'
      : 'AUTHENTICATED';

    // 2. Cache Resolution
    const contextKey = JSON.stringify(context);
    const cacheKey = `${userId || 'guest'}:${surface}:${profileVersion}:${DISCOVERY_ALGORITHM_VERSION}:${limit}:${contextKey}`;

    if (!forceRefresh) {
      const cached = discoveryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.data, isCached: true };
      }
    }

    // 3. Assemble Candidates
    let candidatePool: CandidateWithProvenance[] = [];

    if (isGuest || !taste) {
      // Guest / Cold-Start Catalog Candidates
      const guestAnime = await prisma.anime.findMany({
        where: { score: { gte: 7.5 } },
        orderBy: { score: { sort: 'desc', nulls: 'last' } },
        take: Math.max(limit * 3, 40),
        include: this.getAnimeIncludeBlock(),
      });

      candidatePool = guestAnime.map((a) => ({
        anime: a,
        sources: ['POPULAR'],
        provenanceReasons: ['High community acclaim on OTAKUVA'],
        initialScore: a.score ? a.score / 10 : 0.75,
      }));
    } else {
      // Authenticated Candidate Assembly from 12 pipelines
      candidatePool = await candidateGenerationEngine.assembleCandidatePool(userId, taste, {
        targetAnimeId: context.targetAnimeId,
        poolLimit: Math.max(limit * 4, 100),
      });
    }

    // 4. Surface-Specific Scoring & Ranking
    const scoredItems: DiscoveryItem[] = [];

    for (const cand of candidatePool) {
      const features = contentPreferenceEngine.extractAnimeFeatures(cand.anime);
      let affinityScore = 0.5;
      let reasons: string[] = [...cand.provenanceReasons];

      if (taste) {
        const affinity = contentPreferenceEngine.calculateAffinity(taste, features);
        affinityScore = affinity.overallAffinity;
        if (affinity.reasons.length > 0) {
          reasons = [...reasons, ...affinity.reasons];
        }
      }

      // Base discovery score (0.0 to 10.0)
      const bayesian = features.bayesianScore;
      const qualityFactor = (bayesian - 5.0) / 5.0; // 0.0 to 1.0

      // Compute compound discovery score tailored to surface
      let surfaceWeight = 1.0;
      if (surface === 'SIMILAR_ANIME') {
        surfaceWeight = cand.sources.includes('CONTENT') ? 1.4 : 1.0;
      } else if (surface === 'STUDIO') {
        surfaceWeight = cand.sources.includes('STUDIO') ? 1.4 : 1.0;
      } else if (surface === 'CREATOR') {
        surfaceWeight = cand.sources.includes('CREATOR') ? 1.4 : 1.0;
      } else if (surface === 'COMMUNITY') {
        surfaceWeight = cand.sources.includes('COMMUNITY') ? 1.4 : 1.0;
      }

      const totalScore = (affinityScore * 0.45 + qualityFactor * 0.35 + cand.initialScore * 0.2) * surfaceWeight;
      const boundedScore = Math.max(1.0, Math.min(10.0, totalScore * 10.0));
      const matchPercentage = Math.min(99, Math.max(50, Math.round(affinityScore * 100)));

      // Structured Explanation
      const primaryReason = reasons[0] || 'Popular with OTAKUVA members';
      let reasonType = 'POPULAR';
      if (cand.sources.includes('STUDIO')) reasonType = 'STUDIO_MATCH';
      else if (cand.sources.includes('CREATOR')) reasonType = 'CREATOR_MATCH';
      else if (cand.sources.includes('COMMUNITY')) reasonType = 'COMMUNITY_TRENDING';
      else if (cand.sources.includes('GENRE')) reasonType = 'GENRE_AFFINITY';
      else if (cand.sources.includes('CONTENT')) reasonType = 'SIMILAR_ANIME';
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
        genres: features.genres,
        themes: features.themes,
        studios: features.studios,
        discoveryScore: parseFloat(boundedScore.toFixed(2)),
        matchPercentage: isGuest ? undefined : matchPercentage,
        explanation: primaryReason,
        structuredExplanation: {
          reasonType,
          reasonText: primaryReason,
          reasonData: { sources: cand.sources },
        },
        sources: cand.sources,
        provenance: reasons,
      });
    }

    // 5. Ranking & Diversification
    scoredItems.sort((a, b) => b.discoveryScore - a.discoveryScore);

    // Apply genre diversity constraints
    const diversified: DiscoveryItem[] = [];
    const genreDistribution: Record<string, number> = {};
    const maxPerGenre = Math.max(2, Math.floor(limit * 0.4));
    const deferred: DiscoveryItem[] = [];

    for (const item of scoredItems) {
      const primaryGenre = item.genres[0] || 'Uncategorized';
      const count = genreDistribution[primaryGenre] || 0;

      if (count < maxPerGenre) {
        diversified.push(item);
        genreDistribution[primaryGenre] = count + 1;
      } else {
        deferred.push(item);
      }

      if (diversified.length >= limit) break;
    }

    if (diversified.length < limit) {
      for (const item of deferred) {
        diversified.push(item);
        if (diversified.length >= limit) break;
      }
    }

    const response: DiscoveryResponse = {
      surface,
      algorithmVersion: DISCOVERY_ALGORITHM_VERSION,
      profileVersion,
      personalizationTier,
      totalEvaluated: candidatePool.length,
      items: diversified,
      context,
      isCached: false,
      generatedAt: new Date().toISOString(),
    };

    // Save to Cache
    discoveryCache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return response;
  }

  /**
   * Invalidates discovery cache for a user
   */
  invalidateCache(userId: string) {
    for (const key of discoveryCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        discoveryCache.delete(key);
      }
    }
  }

  private getAnimeIncludeBlock() {
    return {
      animeGenres: { include: { genre: true } },
      animeThemes: { include: { theme: true } },
      animeStudios: { include: { studio: true } },
      staff: { include: { person: true } },
      ratingAggregate: true,
      communityOpinion: true,
      trendMetric: true,
    };
  }
}

export const discoveryCoreService = new DiscoveryCoreService();
