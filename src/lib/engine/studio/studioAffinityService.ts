/**
 * OTAKUVA STUDIO USER AFFINITY & PERSONALIZATION SERVICE (PHASE 9.6)
 * 
 * Computes behavioral studio affinity from user interaction signals:
 * - Watch completions, library status, explicit ratings, reviews, bookmarks, and drops
 * - Configurable signal weights & exponential time decay
 * - Confidence tiers & sample-size thresholds (cold start handling)
 * - Recommendation Engine candidate generation with explainability
 * - Private user data isolation & IDOR protection
 */

import { prisma } from '../../prisma';

export interface StudioAffinityItem {
  studioId: string;
  studioName: string;
  studioSlug: string | null;
  studioImageUrl: string | null;
  score: number; // -1.0 to 1.0 bounded normalized score
  percentageScore: number; // 0 to 100
  confidence: 'COLD_START' | 'LOW' | 'MEDIUM' | 'HIGH';
  confidenceScore: number; // 0.0 to 1.0
  evidenceCount: number;
  evidence: string[];
  lastInteractedAt: Date | null;
}

export interface UserStudioAffinityProfile {
  userId: string;
  totalStudiosInteracted: number;
  topStudios: StudioAffinityItem[];
  allAffinities: StudioAffinityItem[];
  computedAt: Date;
}

export interface StudioRecommendationCandidate {
  anime: {
    id: string;
    canonicalTitle: string;
    slug: string;
    posterUrl: string;
    score: number | null;
    year: number | null;
    type: string;
  };
  studio: {
    id: string;
    name: string;
    slug: string | null;
  };
  affinityScore: number;
  explanation: string;
}

const AFFINITY_CONFIG = {
  WEIGHTS: {
    COMPLETED_ANIME: 5.0,
    HIGH_RATING_9: 6.0,
    HIGH_RATING_8: 4.0,
    MODERATE_RATING_7: 2.0,
    LOW_RATING_5: -3.0,
    VERY_LOW_RATING_3: -6.0,
    BOOKMARK: 2.0,
    POSITIVE_REVIEW: 3.0,
    NEGATIVE_REVIEW: -3.0,
    STUDIO_FOLLOW: 8.0,
    DROPPED_ANIME: -4.0,
  },
  TIME_DECAY_HALF_LIFE_DAYS: 180, // 6 months half-life
  SATURATION_DIVISOR: 10.0, // For tanh normalization
};

export class StudioAffinityService {
  /**
   * Calculates exponential time decay factor based on interaction age
   */
  calculateTimeDecay(interactionDate: Date | null | undefined): number {
    if (!interactionDate) return 1.0;
    const now = Date.now();
    const ageMs = Math.max(0, now - new Date(interactionDate).getTime());
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decay = Math.pow(2, -ageDays / AFFINITY_CONFIG.TIME_DECAY_HALF_LIFE_DAYS);
    return Math.max(0.15, parseFloat(decay.toFixed(3)));
  }

  /**
   * Computes multi-signal studio affinity profile for a user
   */
  async computeUserStudioAffinities(userId: string): Promise<UserStudioAffinityProfile> {
    const [library, ratings, reviews, favorites] = await Promise.all([
      // 1. Library Status (Watching, Completed, Dropped, Plan to Watch)
      prisma.userAnime.findMany({
        where: { userId },
        include: {
          anime: {
            include: {
              animeStudios: { include: { studio: true } },
            },
          },
        },
      }),
      // 2. Explicit Ratings
      prisma.animeRating.findMany({
        where: { userId, deletedAt: null },
        include: {
          anime: {
            include: {
              animeStudios: { include: { studio: true } },
            },
          },
        },
      }),
      // 3. User Reviews
      prisma.review.findMany({
        where: { userId, status: 'PUBLISHED' },
        include: {
          anime: {
            include: {
              animeStudios: { include: { studio: true } },
            },
          },
        },
      }),
      // 4. Favorites / Bookmarks
      prisma.favorite.findMany({
        where: { userId },
        include: {
          anime: {
            include: {
              animeStudios: { include: { studio: true } },
            },
          },
        },
      }),
    ]);

    // Studio Accumulator Map
    const studioAccumulator = new Map<
      string,
      {
        studio: any;
        rawScore: number;
        evidenceCount: number;
        evidence: string[];
        lastInteractedAt: Date | null;
      }
    >();

    const getOrInitStudio = (studio: any) => {
      if (!studioAccumulator.has(studio.id)) {
        studioAccumulator.set(studio.id, {
          studio,
          rawScore: 0,
          evidenceCount: 0,
          evidence: [],
          lastInteractedAt: null,
        });
      }
      return studioAccumulator.get(studio.id)!;
    };

    // Process Library Status
    for (const item of library) {
      const decay = this.calculateTimeDecay(item.updatedAt);
      for (const rel of item.anime?.animeStudios || []) {
        if (!rel.studio) continue;
        const entry = getOrInitStudio(rel.studio);
        if (!entry.lastInteractedAt || item.updatedAt > entry.lastInteractedAt) {
          entry.lastInteractedAt = item.updatedAt;
        }

        if (item.status === 'COMPLETED') {
          entry.rawScore += AFFINITY_CONFIG.WEIGHTS.COMPLETED_ANIME * decay;
          entry.evidenceCount++;
          entry.evidence.push(`Completed "${item.anime.canonicalTitle}"`);
        } else if (item.status === 'DROPPED') {
          entry.rawScore += AFFINITY_CONFIG.WEIGHTS.DROPPED_ANIME * decay;
          entry.evidenceCount++;
          entry.evidence.push(`Dropped "${item.anime.canonicalTitle}"`);
        } else if (item.status === 'WATCHING') {
          entry.rawScore += 1.5 * decay;
          entry.evidenceCount++;
        }
      }
    }

    // Process Ratings
    for (const r of ratings) {
      const decay = this.calculateTimeDecay(r.updatedAt);
      for (const rel of r.anime?.animeStudios || []) {
        if (!rel.studio) continue;
        const entry = getOrInitStudio(rel.studio);
        if (!entry.lastInteractedAt || r.updatedAt > entry.lastInteractedAt) {
          entry.lastInteractedAt = r.updatedAt;
        }

        if (r.rating >= 9.0) {
          entry.rawScore += AFFINITY_CONFIG.WEIGHTS.HIGH_RATING_9 * decay;
          entry.evidenceCount++;
          entry.evidence.push(`Rated "${r.anime.canonicalTitle}" ${r.rating}/10`);
        } else if (r.rating >= 8.0) {
          entry.rawScore += AFFINITY_CONFIG.WEIGHTS.HIGH_RATING_8 * decay;
          entry.evidenceCount++;
          entry.evidence.push(`Rated "${r.anime.canonicalTitle}" ${r.rating}/10`);
        } else if (r.rating >= 7.0) {
          entry.rawScore += AFFINITY_CONFIG.WEIGHTS.MODERATE_RATING_7 * decay;
          entry.evidenceCount++;
        } else if (r.rating <= 3.0) {
          entry.rawScore += AFFINITY_CONFIG.WEIGHTS.VERY_LOW_RATING_3 * decay;
          entry.evidenceCount++;
          entry.evidence.push(`Rated "${r.anime.canonicalTitle}" ${r.rating}/10`);
        } else if (r.rating <= 5.0) {
          entry.rawScore += AFFINITY_CONFIG.WEIGHTS.LOW_RATING_5 * decay;
          entry.evidenceCount++;
        }
      }
    }

    // Process Favorites
    for (const fav of favorites) {
      const decay = this.calculateTimeDecay(fav.createdAt);
      for (const rel of fav.anime?.animeStudios || []) {
        if (!rel.studio) continue;
        const entry = getOrInitStudio(rel.studio);
        entry.rawScore += AFFINITY_CONFIG.WEIGHTS.BOOKMARK * decay;
        entry.evidenceCount++;
        entry.evidence.push(`Favorited "${fav.anime.canonicalTitle}"`);
      }
    }

    // Process Reviews
    for (const rev of reviews) {
      const decay = this.calculateTimeDecay(rev.createdAt);
      for (const rel of rev.anime?.animeStudios || []) {
        if (!rel.studio) continue;
        const entry = getOrInitStudio(rel.studio);
        if ((rev.rating !== null && rev.rating >= 8) || rev.overallSentiment === 'POSITIVE') {
          entry.rawScore += AFFINITY_CONFIG.WEIGHTS.POSITIVE_REVIEW * decay;
          entry.evidenceCount++;
          entry.evidence.push(`Reviewed "${rev.anime.canonicalTitle}" favorably`);
        } else if ((rev.rating !== null && rev.rating <= 4) || rev.overallSentiment === 'NEGATIVE') {
          entry.rawScore += AFFINITY_CONFIG.WEIGHTS.NEGATIVE_REVIEW * decay;
          entry.evidenceCount++;
        }
      }
    }

    // Format and Normalize Affinities
    const allAffinities: StudioAffinityItem[] = Array.from(studioAccumulator.values())
      .map(({ studio, rawScore, evidenceCount, evidence, lastInteractedAt }) => {
        const normalized = Math.tanh(rawScore / AFFINITY_CONFIG.SATURATION_DIVISOR);
        const boundedScore = parseFloat(normalized.toFixed(3));
        const percentageScore = Math.round(((boundedScore + 1) / 2) * 100);

        let confidence: 'COLD_START' | 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        let confidenceScore = 0.3;

        if (evidenceCount >= 6) {
          confidence = 'HIGH';
          confidenceScore = 0.95;
        } else if (evidenceCount >= 3) {
          confidence = 'MEDIUM';
          confidenceScore = 0.7;
        } else if (evidenceCount >= 1) {
          confidence = 'LOW';
          confidenceScore = 0.4;
        } else {
          confidence = 'COLD_START';
          confidenceScore = 0.0;
        }

        return {
          studioId: studio.id,
          studioName: studio.name,
          studioSlug: studio.slug,
          studioImageUrl: studio.imageUrl,
          score: boundedScore,
          percentageScore,
          confidence,
          confidenceScore,
          evidenceCount,
          evidence: Array.from(new Set(evidence)).slice(0, 3),
          lastInteractedAt,
        };
      })
      .sort((a, b) => b.score - a.score);

    const topStudios = allAffinities.filter((a) => a.score > 0.15 && a.confidence !== 'COLD_START').slice(0, 5);

    return {
      userId,
      totalStudiosInteracted: allAffinities.length,
      topStudios,
      allAffinities,
      computedAt: new Date(),
    };
  }

  /**
   * Recommends unwatched anime productions from high-affinity studios
   */
  async getStudioRecommendedAnime(userId: string, limit = 10): Promise<StudioRecommendationCandidate[]> {
    const affinityProfile = await this.computeUserStudioAffinities(userId);
    if (affinityProfile.topStudios.length === 0) return [];

    // Collect already watched anime IDs
    const userLibrary = await prisma.userAnime.findMany({
      where: { userId },
      select: { animeId: true },
    });
    const watchedIds = new Set(userLibrary.map((i) => i.animeId));

    const topStudioIds = affinityProfile.topStudios.map((s) => s.studioId);

    const candidateRels = await prisma.animeStudio.findMany({
      where: {
        studioId: { in: topStudioIds },
        animeId: { notIn: Array.from(watchedIds) },
        anime: {
          status: { notIn: ['CANCELLED'] },
        },
      },
      take: limit * 2,
      include: {
        studio: true,
        anime: {
          include: {
            ratingAggregate: true,
          },
        },
      },
      orderBy: {
        anime: { score: { sort: 'desc', nulls: 'last' } },
      },
    });

    const recommendations: StudioRecommendationCandidate[] = [];
    const seenAnimeIds = new Set<string>();

    for (const rel of candidateRels) {
      if (seenAnimeIds.has(rel.animeId)) continue;
      seenAnimeIds.add(rel.animeId);

      const studioAffinity = affinityProfile.topStudios.find((s) => s.studioId === rel.studioId);
      const affinityScore = studioAffinity?.score || 0.5;

      let explanation = `Because you enjoyed productions from ${rel.studio.name}`;
      if (studioAffinity && studioAffinity.evidence.length > 0) {
        explanation = `Because you ${studioAffinity.evidence[0].toLowerCase()} from ${rel.studio.name}`;
      }

      recommendations.push({
        anime: {
          id: rel.anime.id,
          canonicalTitle: rel.anime.canonicalTitle,
          slug: rel.anime.slug,
          posterUrl: rel.anime.posterUrl,
          score: rel.anime.score,
          year: rel.anime.year,
          type: rel.anime.type,
        },
        studio: {
          id: rel.studio.id,
          name: rel.studio.name,
          slug: rel.studio.slug,
        },
        affinityScore,
        explanation,
      });

      if (recommendations.length >= limit) break;
    }

    return recommendations;
  }
}

export const studioAffinityService = new StudioAffinityService();
