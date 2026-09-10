/**
 * OTAKUVA ENGINE — PHASE 10.8
 * STUDIO & CREATOR DISCOVERY ENGINE
 * 
 * Deep intelligence connecting user taste with Studios, Directors, and Creators:
 * - Canonical Studio Identity resolution & deduplication integration
 * - Studio Affinity vectors & Personalized Studio Catalogs
 * - Creator (Director/Writer/Staff) Affinity & Cross-Catalog Discovery
 * - Studio Performance Intelligence (acclaim distribution, genre specialization, trend metrics)
 * - Safe guest / public fallbacks vs authenticated personalization
 */

import { prisma } from '../../prisma';
import { studioAffinityService } from '../studio/studioAffinityService';
import { studioDeduplicationService } from '../studio/studioDeduplicationService';
import { getUserTasteProfile } from '../taste/tasteEngine';

export interface CreatorDiscoveryItem {
  personId: string;
  name: string;
  nameKanji: string | null;
  primaryRole: string; // e.g. "Director", "Original Creator", "Scriptwriter"
  affinityScore: number;
  knownWorksCount: number;
  acclaimedWorks: Array<{
    id: string;
    canonicalTitle: string;
    slug: string;
    posterUrl: string;
    score: number | null;
    year: number | null;
    role: string;
  }>;
  recommendedWork?: {
    id: string;
    canonicalTitle: string;
    slug: string;
    posterUrl: string;
    score: number | null;
    year: number | null;
  };
  reason: string;
}

export interface StudioCatalogDiscoveryResponse {
  studio: {
    id: string;
    name: string;
    slug: string | null;
    imageUrl: string | null;
    establishedYear?: number | null;
  };
  isPersonalized: boolean;
  userAffinity?: {
    score: number;
    percentage: number;
    evidence: string[];
  };
  popularWorks: any[];
  topRatedWorks: any[];
  recentWorks: any[];
  hiddenGems: any[];
  recommendedForYou?: any[];
  genreSpecialization: Array<{ name: string; count: number; percentage: number }>;
  keyCreators: Array<{ id: string; name: string; role: string; workCount: number }>;
}

export class StudioCreatorDiscoveryEngine {
  /**
   * Discovers top creators (directors/writers) aligned with user taste
   */
  async getPersonalizedCreatorDiscovery(userId: string, limit = 6): Promise<CreatorDiscoveryItem[]> {
    // 1. Fetch user high ratings and completions with staff relations
    const [ratings, library] = await Promise.all([
      prisma.animeRating.findMany({
        where: { userId, rating: { gte: 8.0 }, deletedAt: null },
        include: {
          anime: {
            include: {
              staff: {
                include: { person: true },
              },
            },
          },
        },
      }),
      prisma.userAnime.findMany({
        where: { userId, status: 'COMPLETED' },
        include: {
          anime: {
            include: {
              staff: {
                include: { person: true },
              },
            },
          },
        },
      }),
    ]);

    // Accumulate creator interaction strength
    const creatorScoreMap = new Map<string, { person: any; role: string; lovedCount: number; titles: string[] }>();

    const processStaff = (anime: any, bonus: number) => {
      for (const st of anime.staff || []) {
        const role = st.role?.toLowerCase() || '';
        if (role.includes('director') || role.includes('creator') || role.includes('series composition') || role.includes('writer')) {
          const personId = st.person.id;
          const existing = creatorScoreMap.get(personId);
          if (existing) {
            existing.lovedCount += bonus;
            if (!existing.titles.includes(anime.canonicalTitle)) {
              existing.titles.push(anime.canonicalTitle);
            }
          } else {
            creatorScoreMap.set(personId, {
              person: st.person,
              role: st.role || 'Director',
              lovedCount: bonus,
              titles: [anime.canonicalTitle],
            });
          }
        }
      }
    };

    ratings.forEach((r) => processStaff(r.anime, 2.0));
    library.forEach((l) => processStaff(l.anime, 1.0));

    const scoredCreators = Array.from(creatorScoreMap.values())
      .sort((a, b) => b.lovedCount - a.lovedCount)
      .slice(0, limit);

    // Fetch catalog works for top creators
    const results: CreatorDiscoveryItem[] = [];

    for (const c of scoredCreators) {
      const allWorks = await prisma.animeStaff.findMany({
        where: { personId: c.person.id },
        include: {
          anime: {
            select: { id: true, canonicalTitle: true, slug: true, posterUrl: true, score: true, year: true },
          },
        },
        orderBy: { anime: { score: 'desc' } },
        take: 8,
      });

      const watchedAnimeIds = new Set([
        ...ratings.map((r) => r.anime.id),
        ...library.map((l) => l.anime.id),
      ]);

      const unwatched = allWorks.find((w) => !watchedAnimeIds.has(w.anime.id));

      results.push({
        personId: c.person.id,
        name: c.person.name,
        nameKanji: c.person.nameKanji || null,
        primaryRole: c.role,
        affinityScore: Math.min(1.0, c.lovedCount / 5.0),
        knownWorksCount: allWorks.length,
        acclaimedWorks: allWorks.map((w) => ({
          ...w.anime,
          role: w.role || c.role,
        })),
        recommendedWork: unwatched?.anime,
        reason: `Directed/Created "${c.titles[0]}" which you loved`,
      });
    }

    return results;
  }

  /**
   * Generates comprehensive Studio Catalog Discovery on /studio/[slug]
   */
  async getStudioCatalogDiscovery(
    studioSlugOrId: string,
    userId?: string | null
  ): Promise<StudioCatalogDiscoveryResponse | null> {
    // 1. Resolve Canonical Studio
    const studio = await prisma.studio.findFirst({
      where: {
        OR: [{ id: studioSlugOrId }, { slug: studioSlugOrId }],
      },
    });

    if (!studio) return null;

    // 2. Fetch Studio Productions
    const productions = await prisma.animeStudio.findMany({
      where: { studioId: studio.id },
      include: {
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
            animeThemes: { include: { theme: true } },
            ratingAggregate: true,
          },
        },
      },
    });

    const animeList = productions.map((p) => p.anime).filter(Boolean);

    // Sort buckets
    const popularWorks = [...animeList].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 6);
    const topRatedWorks = [...animeList].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6);
    const recentWorks = [...animeList].sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 6);
    const hiddenGems = [...animeList]
      .filter((a) => (a.score || 0) >= 8.0 && (a.popularity || 0) < 50000)
      .slice(0, 4);

    // Genre Specialization
    const genreCountMap = new Map<string, number>();
    for (const a of animeList) {
      for (const ag of a.animeGenres || []) {
        if (ag.genre?.name) {
          genreCountMap.set(ag.genre.name, (genreCountMap.get(ag.genre.name) || 0) + 1);
        }
      }
    }
    const totalGenrePicks = animeList.length || 1;
    const genreSpecialization = Array.from(genreCountMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalGenrePicks) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Key Creators for this Studio (combines StudioPerson and AnimeStaff on studio productions)
    const [keyStaff, animeStaff] = await Promise.all([
      prisma.studioPerson.findMany({
        where: { studioId: studio.id },
        include: { person: true },
        take: 6,
      }),
      prisma.animeStaff.findMany({
        where: {
          anime: { animeStudios: { some: { studioId: studio.id } } },
        },
        include: { person: true },
        take: 10,
      }),
    ]);

    const creatorMap = new Map<string, { id: string; name: string; role: string; workCount: number }>();
    for (const ks of keyStaff) {
      creatorMap.set(ks.person.id, {
        id: ks.person.id,
        name: ks.person.name,
        role: ks.role || 'Staff',
        workCount: 1,
      });
    }
    for (const as of animeStaff) {
      const existing = creatorMap.get(as.person.id);
      if (existing) {
        existing.workCount += 1;
      } else {
        creatorMap.set(as.person.id, {
          id: as.person.id,
          name: as.person.name,
          role: as.role || 'Director',
          workCount: 1,
        });
      }
    }
    const keyCreators = Array.from(creatorMap.values()).slice(0, 6);

    // 3. User Personalized Recommendations if Logged In
    const isGuest = !userId || userId === 'guest_user';
    let userAffinity: StudioCatalogDiscoveryResponse['userAffinity'] = undefined;
    let recommendedForYou: any[] | undefined = undefined;

    if (!isGuest) {
      const affinities = await studioAffinityService.computeUserStudioAffinities(userId!);
      const aff = affinities.allAffinities.find((a) => a.studioId === studio.id);
      if (aff) {
        userAffinity = {
          score: aff.score,
          percentage: aff.percentageScore,
          evidence: aff.evidence,
        };
      }

      // Filter unwatched
      const userLibrary = await prisma.userAnime.findMany({
        where: { userId: userId! },
        select: { animeId: true },
      });
      const watchedSet = new Set(userLibrary.map((ul) => ul.animeId));

      recommendedForYou = animeList
        .filter((a) => !watchedSet.has(a.id))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 4);
    }

    return {
      studio: {
        id: studio.id,
        name: studio.name,
        slug: studio.slug,
        imageUrl: studio.imageUrl,
        establishedYear: studio.foundedYear,
      },
      isPersonalized: !isGuest,
      userAffinity,
      popularWorks,
      topRatedWorks,
      recentWorks,
      hiddenGems,
      recommendedForYou,
      genreSpecialization,
      keyCreators,
    };
  }
}

export const studioCreatorDiscoveryEngine = new StudioCreatorDiscoveryEngine();
