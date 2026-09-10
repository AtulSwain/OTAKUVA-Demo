/**
 * OTAKUVA ENGINE — PHASE 10.4
 * RECOMMENDATION CANDIDATE GENERATION ENGINE
 * 
 * Multi-source candidate generation with franchise/sequel awareness & hard filtering:
 * 12 Candidate Sources:
 * 1. Content-based (similar to user's highest rated titles)
 * 2. Genre-based (top genre affinities)
 * 3. Theme-based (top theme affinities)
 * 4. Studio-based (top studio affinities)
 * 5. Creator-based (top directors/creators)
 * 6. Collaborative Signals (similar user cohorts)
 * 7. Popularity Baseline (high Bayesian score catalog quality)
 * 8. Trending Signals (high interaction velocity & momentum)
 * 9. Seasonal Discovery (current season releases)
 * 10. Community Signals (active in user's joined communities)
 * 11. News Signals (prominently covered in recent news)
 * 12. Exploration (adjacent & novel discoveries)
 */

import { prisma } from '../../prisma';
import { UserTasteProfileResult } from '../taste/tasteEngine';
import { ADJACENT_GENRES } from './contentPreferenceEngine';

export type CandidateSourceType =
  | 'CONTENT'
  | 'GENRE'
  | 'THEME'
  | 'STUDIO'
  | 'CREATOR'
  | 'COLLABORATIVE'
  | 'POPULAR'
  | 'TRENDING'
  | 'SEASONAL'
  | 'COMMUNITY'
  | 'NEWS'
  | 'EXPLORATION';

export interface CandidateWithProvenance {
  anime: any;
  sources: CandidateSourceType[];
  provenanceReasons: string[];
  initialScore: number;
}

export class CandidateGenerationEngine {
  /**
   * 1. Content-based (similar to user's high-rated or completed works)
   */
  async generateContentCandidates(userId: string, excludedIds: Set<string>, limit = 30): Promise<CandidateWithProvenance[]> {
    const highRated = await prisma.animeRating.findMany({
      where: { userId, rating: { gte: 8.0 }, deletedAt: null },
      take: 5,
      orderBy: { rating: 'desc' },
      include: {
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
            animeStudios: { include: { studio: true } },
          },
        },
      },
    });

    if (highRated.length === 0) return [];

    const genreNames = Array.from(
      new Set(highRated.flatMap((r) => r.anime.animeGenres.map((g) => g.genre.name)))
    );
    const studioNames = Array.from(
      new Set(highRated.flatMap((r) => r.anime.animeStudios.map((s) => s.studio.name)))
    );

    const candidates = await prisma.anime.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        OR: [
          { animeGenres: { some: { genre: { name: { in: genreNames } } } } },
          { animeStudios: { some: { studio: { name: { in: studioNames } } } } },
        ],
      },
      take: limit,
      include: this.getAnimeIncludeBlock(),
    });

    const topRatedTitle = highRated[0].anime.canonicalTitle;
    return candidates.map((a) => ({
      anime: a,
      sources: ['CONTENT'],
      provenanceReasons: [`Similar to "${topRatedTitle}" which you rated ${highRated[0].rating}/10`],
      initialScore: 0.8,
    }));
  }

  /**
   * 1.1 Direct Franchise & Sequel Candidates from completed titles
   */
  async generateFranchiseCandidates(userId: string, excludedIds: Set<string>, limit = 15): Promise<CandidateWithProvenance[]> {
    const completed = await prisma.userAnime.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { animeId: true, anime: { select: { canonicalTitle: true } } },
    });

    if (completed.length === 0) return [];
    const completedIds = completed.map((c) => c.animeId);

    // Find sequels or side stories of completed anime
    const relations = await prisma.animeRelation.findMany({
      where: {
        sourceAnimeId: { in: completedIds },
        targetAnimeId: { notIn: Array.from(excludedIds) },
        relationType: { in: ['Sequel', 'Side story', 'Spin-off', 'Alternative setting', 'Prequel'] },
      },
      include: {
        targetAnime: {
          include: this.getAnimeIncludeBlock(),
        },
        sourceAnime: {
          select: { canonicalTitle: true },
        },
      },
      take: limit,
    });

    return relations.map((r) => ({
      anime: r.targetAnime,
      sources: ['CONTENT'],
      provenanceReasons: [`Direct ${r.relationType.toLowerCase()} to "${r.sourceAnime.canonicalTitle}" which you completed`],
      initialScore: 0.9,
    }));
  }

  /**
   * 2. Genre-based
   */
  async generateGenreCandidates(taste: UserTasteProfileResult, excludedIds: Set<string>, limit = 35): Promise<CandidateWithProvenance[]> {
    if (taste.topGenres.length === 0) return [];

    const candidates = await prisma.anime.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        animeGenres: { some: { genre: { name: { in: taste.topGenres } } } },
      },
      take: limit,
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['GENRE'],
      provenanceReasons: [`Matches your preference for ${taste.topGenres[0]}`],
      initialScore: 0.75,
    }));
  }

  /**
   * 3. Theme-based
   */
  async generateThemeCandidates(taste: UserTasteProfileResult, excludedIds: Set<string>, limit = 25): Promise<CandidateWithProvenance[]> {
    if (taste.topThemes.length === 0) return [];

    const candidates = await prisma.anime.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        animeThemes: { some: { theme: { name: { in: taste.topThemes } } } },
      },
      take: limit,
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['THEME'],
      provenanceReasons: [`Features ${taste.topThemes[0]} theme`],
      initialScore: 0.7,
    }));
  }

  /**
   * 4. Studio-based
   */
  async generateStudioCandidates(taste: UserTasteProfileResult, excludedIds: Set<string>, limit = 20): Promise<CandidateWithProvenance[]> {
    if (taste.topStudios.length === 0) return [];

    const candidates = await prisma.anime.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        animeStudios: { some: { studio: { name: { in: taste.topStudios } } } },
      },
      take: limit,
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['STUDIO'],
      provenanceReasons: [`From Studio ${taste.topStudios[0]}, which you enjoy`],
      initialScore: 0.75,
    }));
  }

  /**
   * 5. Creator / Director-based
   */
  async generateCreatorCandidates(taste: UserTasteProfileResult, excludedIds: Set<string>, limit = 15): Promise<CandidateWithProvenance[]> {
    const topCreators = Object.entries(taste.creators || {})
      .filter(([_, d]) => d.score > 0.2)
      .map(([name]) => name);

    if (topCreators.length === 0) return [];

    const candidates = await prisma.anime.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        staff: { some: { person: { name: { in: topCreators } } } },
      },
      take: limit,
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['CREATOR'],
      provenanceReasons: [`Directed/Created by ${topCreators[0]}`],
      initialScore: 0.7,
    }));
  }

  /**
   * 6. Collaborative Signals
   */
  async generateCollaborativeCandidates(userId: string, excludedIds: Set<string>, limit = 20): Promise<CandidateWithProvenance[]> {
    const myRatings = await prisma.animeRating.findMany({
      where: { userId, rating: { gte: 8 }, deletedAt: null },
      select: { animeId: true },
      take: 10,
    });

    if (myRatings.length === 0) return [];
    const myAnimeIds = myRatings.map((r) => r.animeId);

    // Find other users with shared high ratings
    const peerRatings = await prisma.animeRating.findMany({
      where: {
        animeId: { in: myAnimeIds },
        userId: { not: userId },
        rating: { gte: 8 },
        deletedAt: null,
      },
      select: { userId: true },
      take: 30,
    });

    const peerUserIds = Array.from(new Set(peerRatings.map((p) => p.userId)));
    if (peerUserIds.length === 0) return [];

    // Find anime highly rated by peers
    const peerFavorites = await prisma.animeRating.findMany({
      where: {
        userId: { in: peerUserIds },
        animeId: { notIn: Array.from(excludedIds) },
        rating: { gte: 8.5 },
        deletedAt: null,
      },
      select: { animeId: true },
      take: limit,
    });

    const candidateIds = Array.from(new Set(peerFavorites.map((p) => p.animeId)));
    if (candidateIds.length === 0) return [];

    const candidates = await prisma.anime.findMany({
      where: { id: { in: candidateIds } },
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['COLLABORATIVE'],
      provenanceReasons: ['Highly rated by fans with taste similar to yours'],
      initialScore: 0.82,
    }));
  }

  /**
   * 7. Popularity / Quality Baseline
   */
  async generatePopularCandidates(excludedIds: Set<string>, limit = 25): Promise<CandidateWithProvenance[]> {
    const candidates = await prisma.anime.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        score: { gte: 7.8 },
      },
      orderBy: { score: 'desc' },
      take: limit,
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['POPULAR'],
      provenanceReasons: ['High community rating & critical acclaim'],
      initialScore: 0.65,
    }));
  }

  /**
   * 8. Trending Signals
   */
  async generateTrendingCandidates(excludedIds: Set<string>, limit = 20): Promise<CandidateWithProvenance[]> {
    const candidates = await prisma.anime.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        trendMetric: { isNot: null },
      },
      orderBy: { trendMetric: { momentumScore: 'desc' } },
      take: limit,
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['TRENDING'],
      provenanceReasons: ['Trending now with high community engagement'],
      initialScore: 0.7,
    }));
  }

  /**
   * 9. Seasonal Discovery
   */
  async generateSeasonalCandidates(excludedIds: Set<string>, limit = 15): Promise<CandidateWithProvenance[]> {
    const currentYear = new Date().getFullYear();
    const candidates = await prisma.anime.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        year: { gte: currentYear - 1 },
      },
      orderBy: { popularity: 'desc' },
      take: limit,
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['SEASONAL'],
      provenanceReasons: ['Latest seasonal release'],
      initialScore: 0.68,
    }));
  }

  /**
   * 10. Community Signals
   */
  async generateCommunityCandidates(userId: string, excludedIds: Set<string>, limit = 15): Promise<CandidateWithProvenance[]> {
    const userCommunities = await prisma.communityMember.findMany({
      where: { userId },
      select: { communityId: true },
    });

    if (userCommunities.length === 0) return [];
    const commIds = userCommunities.map((c) => c.communityId);

    const discussions = await prisma.discussion.findMany({
      where: { communityId: { in: commIds }, animeId: { not: null } },
      select: { animeId: true },
      take: 20,
    });

    const animeIds = Array.from(new Set(discussions.map((d) => d.animeId).filter(Boolean) as string[])).filter(
      (id) => !excludedIds.has(id)
    );

    if (animeIds.length === 0) return [];

    const candidates = await prisma.anime.findMany({
      where: { id: { in: animeIds } },
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['COMMUNITY'],
      provenanceReasons: ['Actively discussed in your communities'],
      initialScore: 0.75,
    }));
  }

  /**
   * 11. News Signals
   */
  async generateNewsCandidates(excludedIds: Set<string>, limit = 10): Promise<CandidateWithProvenance[]> {
    const recentNews = await prisma.newsArticleAnime.findMany({
      where: { relationType: 'PRIMARY_SUBJECT' },
      orderBy: { article: { publishedAt: 'desc' } },
      select: { animeId: true },
      take: 20,
    });

    const animeIds = Array.from(new Set(recentNews.map((n) => n.animeId))).filter((id) => !excludedIds.has(id));
    if (animeIds.length === 0) return [];

    const candidates = await prisma.anime.findMany({
      where: { id: { in: animeIds } },
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['NEWS'],
      provenanceReasons: ['Featured in recent industry news & announcements'],
      initialScore: 0.65,
    }));
  }

  /**
   * 12. Exploration Candidates (Adjacent Genres & Controlled Discovery)
   */
  async generateExplorationCandidates(taste: UserTasteProfileResult, excludedIds: Set<string>, limit = 15): Promise<CandidateWithProvenance[]> {
    const primaryGenre = taste.topGenres[0];
    const adjacent = primaryGenre ? ADJACENT_GENRES[primaryGenre] || [] : [];

    const candidates = await prisma.anime.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        score: { gte: 7.8 },
        animeGenres: {
          some: { genre: { name: { in: adjacent } } },
          none: { genre: { name: { in: taste.topGenres } } },
        },
      },
      orderBy: { score: 'desc' },
      take: limit,
      include: this.getAnimeIncludeBlock(),
    });

    return candidates.map((a) => ({
      anime: a,
      sources: ['EXPLORATION'],
      provenanceReasons: [
        primaryGenre
          ? `Exploration: Adjacent to your love for ${primaryGenre}`
          : 'High quality discovery outside typical recommendations',
      ],
      initialScore: 0.7,
    }));
  }

  /**
   * Master Candidate Pool Assembler with Franchise / Sequel Awareness
   */
  async assembleCandidatePool(userId: string, taste: UserTasteProfileResult, options: { targetAnimeId?: string; poolLimit?: number } = {}): Promise<CandidateWithProvenance[]> {
    const { targetAnimeId, poolLimit = 150 } = options;

    // 1. Fetch User Exclusions
    const [library, ratings, feedback] = await Promise.all([
      prisma.userAnime.findMany({
        where: { userId },
        select: { animeId: true, status: true },
      }),
      prisma.animeRating.findMany({
        where: { userId, deletedAt: null },
        select: { animeId: true },
      }),
      prisma.recommendationFeedback.findMany({
        where: { userId, feedback: { in: ['NOT_INTERESTED', 'DISMISSED'] } },
        select: { animeId: true },
      }),
    ]);

    const excludedIds = new Set<string>();
    const completedIds = new Set<string>();

    library.forEach((l) => {
      if (l.status === 'COMPLETED') completedIds.add(l.animeId);
      if (l.status === 'COMPLETED' || l.status === 'WATCHING' || l.status === 'DROPPED') {
        excludedIds.add(l.animeId);
      }
    });
    ratings.forEach((r) => excludedIds.add(r.animeId));
    feedback.forEach((f) => excludedIds.add(f.animeId));

    if (targetAnimeId) excludedIds.add(targetAnimeId);

    // 2. Generate from all candidate sources in parallel
    const [
      content,
      franchise,
      genres,
      themes,
      studios,
      creators,
      collab,
      popular,
      trending,
      seasonal,
      community,
      news,
      exploration,
    ] = await Promise.all([
      this.generateContentCandidates(userId, excludedIds, 30),
      this.generateFranchiseCandidates(userId, excludedIds, 20),
      this.generateGenreCandidates(taste, excludedIds, 35),
      this.generateThemeCandidates(taste, excludedIds, 25),
      this.generateStudioCandidates(taste, excludedIds, 20),
      this.generateCreatorCandidates(taste, excludedIds, 15),
      this.generateCollaborativeCandidates(userId, excludedIds, 20),
      this.generatePopularCandidates(excludedIds, 25),
      this.generateTrendingCandidates(excludedIds, 20),
      this.generateSeasonalCandidates(excludedIds, 15),
      this.generateCommunityCandidates(userId, excludedIds, 15),
      this.generateNewsCandidates(excludedIds, 10),
      this.generateExplorationCandidates(taste, excludedIds, 15),
    ]);

    // 3. Deduplicate and merge multi-source provenance
    const candidateMap = new Map<string, CandidateWithProvenance>();

    const allBatches = [
      content,
      franchise,
      genres,
      themes,
      studios,
      creators,
      collab,
      popular,
      trending,
      seasonal,
      community,
      news,
      exploration,
    ];

    for (const batch of allBatches) {
      for (const item of batch) {
        const existing = candidateMap.get(item.anime.id);
        if (existing) {
          for (const s of item.sources) {
            if (!existing.sources.includes(s)) existing.sources.push(s);
          }
          for (const r of item.provenanceReasons) {
            if (!existing.provenanceReasons.includes(r)) existing.provenanceReasons.push(r);
          }
          existing.initialScore = Math.max(existing.initialScore, item.initialScore);
        } else {
          candidateMap.set(item.anime.id, {
            anime: item.anime,
            sources: [...item.sources],
            provenanceReasons: [...item.provenanceReasons],
            initialScore: item.initialScore,
          });
        }
      }
    }

    // 4. Franchise & Sequel Awareness Check
    // If anime is a Sequel, check if prerequisite is completed
    const candidates = Array.from(candidateMap.values());
    const validCandidates: CandidateWithProvenance[] = [];

    for (const cand of candidates) {
      // Check if candidate is a Sequel
      const relations = await prisma.animeRelation.findMany({
        where: { targetAnimeId: cand.anime.id, relationType: 'Sequel' },
        select: { sourceAnimeId: true },
      });

      if (relations.length > 0) {
        // Candidate is Sequel of sourceAnime. Only include if sourceAnime is completed!
        const hasPrequelCompleted = relations.some((r) => completedIds.has(r.sourceAnimeId));
        if (hasPrequelCompleted) {
          cand.sources.push('CONTENT');
          cand.provenanceReasons.push('Direct sequel to a series you completed');
          cand.initialScore += 0.2;
          validCandidates.push(cand);
        } else {
          // Exclude later season before watching prerequisite
          continue;
        }
      } else {
        validCandidates.push(cand);
      }
    }

    return validCandidates.slice(0, poolLimit);
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

export const candidateGenerationEngine = new CandidateGenerationEngine();
