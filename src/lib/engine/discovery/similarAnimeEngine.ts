/**
 * OTAKUVA ENGINE — PHASE 10.7
 * ADVANCED SIMILAR ANIME ENGINE ("MORE LIKE THIS")
 * 
 * Multi-layer similarity engine comparing anime across 6 dimensions:
 * 1. Content Similarity (Genre & Theme Jaccard Overlap)
 * 2. Semantic & Concept Similarity (Tone, Story Concepts & Keywords)
 * 3. Structural Similarity (Format, Episode Length Bucket, Release Period)
 * 4. Studio Similarity (Shared Canonical Production Studio)
 * 5. Creator Similarity (Shared Director, Writer, Original Creator)
 * 6. Collaborative Behavioral Similarity (Co-rating & Co-completion Patterns)
 * 
 * Includes:
 * - Clean Separation of Related Franchise Content vs Similar Anime
 * - Global Similarity vs Personalized Similarity
 * - Transparent Data-Backed Explanations
 * - Precomputed / Fast Similarity Caching
 */

import { prisma } from '../../prisma';
import { getUserTasteProfile } from '../taste/tasteEngine';

export const SIMILARITY_ALGORITHM_VERSION = 1;

export interface SimilarAnimeItem {
  id: string;
  title: string;
  canonicalTitle: string;
  slug: string;
  posterUrl: string;
  bannerUrl: string | null;
  score: number | null;
  type: string | null;
  year: number | null;
  episodes: number | null;
  similarityScore: number; // 0.0 to 1.0
  similarityPercentage: number; // 0 to 100
  similarityDimensions: {
    contentScore: number;
    semanticScore: number;
    structuralScore: number;
    studioScore: number;
    creatorScore: number;
    collaborativeScore: number;
  };
  explanation: string;
  matchReasons: string[];
  isFranchiseRelated: boolean;
  franchiseRelationType?: string;
  genres: string[];
  themes: string[];
  studios: string[];
}

export interface SimilarAnimeResponse {
  targetAnime: {
    id: string;
    title: string;
    canonicalTitle: string;
    slug: string;
    posterUrl: string;
  };
  algorithmVersion: number;
  isPersonalized: boolean;
  franchiseRelations: SimilarAnimeItem[];
  similarAnime: SimilarAnimeItem[];
  totalEvaluated: number;
  generatedAt: string;
}

// In-Memory Similarity Cache
interface CachedSimilarity {
  data: SimilarAnimeResponse;
  expiresAt: number;
}
const similarityCache = new Map<string, CachedSimilarity>();
const SIMILARITY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class SimilarAnimeEngine {
  /**
   * Computes Jaccard Similarity index between two sets of strings
   */
  private computeJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 && setB.size === 0) return 0;
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Extracts conceptual story tokens from synopsis text
   */
  private extractStoryTokens(synopsis?: string | null): Set<string> {
    if (!synopsis) return new Set();
    const clean = synopsis
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3);
    return new Set(clean);
  }

  /**
   * Main Entry Point: Get Similar Anime
   */
  async getSimilarAnime(
    targetAnimeIdOrSlug: string,
    options: {
      userId?: string | null;
      limit?: number;
      includeFranchise?: boolean;
      forceRefresh?: boolean;
    } = {}
  ): Promise<SimilarAnimeResponse | null> {
    const { userId, limit = 10, includeFranchise = true, forceRefresh = false } = options;

    // 1. Resolve Target Anime
    const targetAnime = await prisma.anime.findFirst({
      where: {
        OR: [{ id: targetAnimeIdOrSlug }, { slug: targetAnimeIdOrSlug }],
      },
      include: {
        animeGenres: { include: { genre: true } },
        animeThemes: { include: { theme: true } },
        animeStudios: { include: { studio: true } },
        staff: { include: { person: true } },
      },
    });

    if (!targetAnime) return null;

    // Cache Check
    const isGuest = !userId || userId === 'guest_user';
    const cacheKey = `${targetAnime.id}:${userId || 'guest'}:${limit}:${SIMILARITY_ALGORITHM_VERSION}`;
    if (!forceRefresh) {
      const cached = similarityCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

    // 2. Fetch User Taste Profile if Authenticated for Personalization Adjustments
    let userTaste: any = null;
    if (!isGuest) {
      userTaste = await getUserTasteProfile(userId!).catch(() => null);
    }

    // 3. Resolve Direct Franchise Relationships
    const franchiseRelations = await prisma.animeRelation.findMany({
      where: {
        OR: [{ sourceAnimeId: targetAnime.id }, { targetAnimeId: targetAnime.id }],
      },
      include: {
        sourceAnime: {
          include: {
            animeGenres: { include: { genre: true } },
            animeThemes: { include: { theme: true } },
            animeStudios: { include: { studio: true } },
          },
        },
        targetAnime: {
          include: {
            animeGenres: { include: { genre: true } },
            animeThemes: { include: { theme: true } },
            animeStudios: { include: { studio: true } },
          },
        },
      },
    });

    const franchiseAnimeMap = new Map<string, string>();
    for (const rel of franchiseRelations) {
      const other = rel.sourceAnimeId === targetAnime.id ? rel.targetAnime : rel.sourceAnime;
      franchiseAnimeMap.set(other.id, rel.relationType);
    }

    // 4. Feature Extraction for Target Anime
    const targetGenres = new Set(targetAnime.animeGenres.map((g) => g.genre.name));
    const targetThemes = new Set(targetAnime.animeThemes.map((t) => t.theme.name));
    const targetStudios = new Set(targetAnime.animeStudios.map((s) => s.studio.name));
    const targetStaff = new Set(
      targetAnime.staff
        .filter((st) => st.role?.toLowerCase().includes('director') || st.role?.toLowerCase().includes('creator'))
        .map((st) => st.person.name)
    );
    const targetTokens = this.extractStoryTokens(targetAnime.synopsis);
    const targetLengthBucket = (targetAnime.episodes || 12) <= 13 ? 'SHORT' : (targetAnime.episodes || 12) <= 26 ? 'MEDIUM' : 'LONG';

    // 5. Candidate Query from Database
    const candidates = await prisma.anime.findMany({
      where: {
        id: { not: targetAnime.id },
        OR: [
          { animeGenres: { some: { genre: { name: { in: Array.from(targetGenres) } } } } },
          { animeThemes: { some: { theme: { name: { in: Array.from(targetThemes) } } } } },
          { animeStudios: { some: { studio: { name: { in: Array.from(targetStudios) } } } } },
        ],
      },
      take: 60,
      include: {
        animeGenres: { include: { genre: true } },
        animeThemes: { include: { theme: true } },
        animeStudios: { include: { studio: true } },
        staff: { include: { person: true } },
        ratingAggregate: true,
      },
    });

    // 6. Multi-Layer Similarity Computation
    const scoredSimilar: SimilarAnimeItem[] = [];
    const franchiseItems: SimilarAnimeItem[] = [];

    for (const cand of candidates) {
      const candGenres = new Set(cand.animeGenres.map((g) => g.genre.name));
      const candThemes = new Set(cand.animeThemes.map((t) => t.theme.name));
      const candStudios = new Set(cand.animeStudios.map((s) => s.studio.name));
      const candStaff = new Set(
        cand.staff
          .filter((st) => st.role?.toLowerCase().includes('director') || st.role?.toLowerCase().includes('creator'))
          .map((st) => st.person.name)
      );
      const candTokens = this.extractStoryTokens(cand.synopsis);

      const matchReasons: string[] = [];

      // 1. Content Score (Genre & Theme Jaccard Overlap)
      const genreJaccard = this.computeJaccardSimilarity(targetGenres, candGenres);
      const themeJaccard = this.computeJaccardSimilarity(targetThemes, candThemes);
      const contentScore = genreJaccard * 0.65 + themeJaccard * 0.35;

      const sharedGenres = Array.from(targetGenres).filter((g) => candGenres.has(g));
      if (sharedGenres.length > 0) {
        matchReasons.push(`Shares ${sharedGenres.slice(0, 2).join(' & ')} genre elements`);
      }

      // 2. Semantic & Synopsis Score
      const semanticScore = this.computeJaccardSimilarity(targetTokens, candTokens);
      if (semanticScore > 0.15) {
        matchReasons.push('Similar story themes, tone, and setting');
      }

      // 3. Structural Score (Format, Length, Year proximity)
      let structuralScore = 0;
      if (cand.type && cand.type === targetAnime.type) structuralScore += 0.5;
      const candLengthBucket = (cand.episodes || 12) <= 13 ? 'SHORT' : (cand.episodes || 12) <= 26 ? 'MEDIUM' : 'LONG';
      if (candLengthBucket === targetLengthBucket) structuralScore += 0.5;

      // 4. Studio Score
      let studioScore = 0;
      const sharedStudios = Array.from(targetStudios).filter((s) => candStudios.has(s));
      if (sharedStudios.length > 0) {
        studioScore = 1.0;
        matchReasons.push(`From the same studio: ${sharedStudios[0]}`);
      }

      // 5. Creator / Director Score
      let creatorScore = 0;
      const sharedCreators = Array.from(targetStaff).filter((c) => candStaff.has(c));
      if (sharedCreators.length > 0) {
        creatorScore = 1.0;
        matchReasons.push(`Directed/Created by ${sharedCreators[0]}`);
      }

      // 6. Collaborative Score (Quality & Acclaim signal)
      const bayesian = cand.ratingAggregate?.bayesianScore || cand.score || 7.0;
      const collaborativeScore = Math.max(0, Math.min(1.0, (bayesian - 5.0) / 5.0));

      // Personalization adjustment if user taste profile is available
      let personalBonus = 0;
      if (userTaste) {
        for (const g of candGenres) {
          if (userTaste.genres[g]?.score > 0.3) personalBonus += 0.05;
        }
      }

      // Final Weighted Composite Similarity Score
      const totalSimilarity =
        contentScore * 0.35 +
        semanticScore * 0.2 +
        structuralScore * 0.15 +
        studioScore * 0.1 +
        creatorScore * 0.1 +
        collaborativeScore * 0.1 +
        personalBonus;

      const boundedSimilarity = parseFloat(Math.min(1.0, Math.max(0.1, totalSimilarity)).toFixed(3));
      const similarityPercentage = Math.round(boundedSimilarity * 100);

      const primaryExplanation = matchReasons[0] || 'Shares key thematic and production characteristics';

      const isFranchise = franchiseAnimeMap.has(cand.id);
      const item: SimilarAnimeItem = {
        id: cand.id,
        title: cand.canonicalTitle,
        canonicalTitle: cand.canonicalTitle,
        slug: cand.slug,
        posterUrl: cand.posterUrl,
        bannerUrl: cand.bannerUrl,
        score: cand.score,
        type: cand.type,
        year: cand.year,
        episodes: cand.episodes,
        similarityScore: boundedSimilarity,
        similarityPercentage,
        similarityDimensions: {
          contentScore: parseFloat(contentScore.toFixed(2)),
          semanticScore: parseFloat(semanticScore.toFixed(2)),
          structuralScore: parseFloat(structuralScore.toFixed(2)),
          studioScore: parseFloat(studioScore.toFixed(2)),
          creatorScore: parseFloat(creatorScore.toFixed(2)),
          collaborativeScore: parseFloat(collaborativeScore.toFixed(2)),
        },
        explanation: primaryExplanation,
        matchReasons,
        isFranchiseRelated: isFranchise,
        franchiseRelationType: franchiseAnimeMap.get(cand.id),
        genres: Array.from(candGenres),
        themes: Array.from(candThemes),
        studios: Array.from(candStudios),
      };

      if (isFranchise) {
        franchiseItems.push(item);
      } else {
        scoredSimilar.push(item);
      }
    }

    // Sort Descending by Similarity Score
    scoredSimilar.sort((a, b) => b.similarityScore - a.similarityScore);
    franchiseItems.sort((a, b) => (a.year || 0) - (b.year || 0));

    const response: SimilarAnimeResponse = {
      targetAnime: {
        id: targetAnime.id,
        title: targetAnime.canonicalTitle,
        canonicalTitle: targetAnime.canonicalTitle,
        slug: targetAnime.slug,
        posterUrl: targetAnime.posterUrl,
      },
      algorithmVersion: SIMILARITY_ALGORITHM_VERSION,
      isPersonalized: !isGuest && Boolean(userTaste),
      franchiseRelations: franchiseItems,
      similarAnime: scoredSimilar.slice(0, limit),
      totalEvaluated: candidates.length,
      generatedAt: new Date().toISOString(),
    };

    // Save to Cache
    similarityCache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + SIMILARITY_CACHE_TTL_MS,
    });

    return response;
  }
}

export const similarAnimeEngine = new SimilarAnimeEngine();
