/**
 * OTAKUVA ENGINE — PHASE 10.9
 * COMMUNITY-BASED DISCOVERY ENGINE
 * 
 * Leverages OTAKUVA community discussions as an authentic discovery signal:
 * - Community -> Anime Graph Traversal
 * - Anti-Spam Protection (Unique participant weighting over raw post volume)
 * - Strict Privacy Enforcement (Private/Restricted communities isolated from non-members)
 * - Personalized Community Feed for authenticated users vs Global Community Trends
 * - Data-backed transparent recommendation reasons
 */

import { prisma } from '../../prisma';
import { getUserTasteProfile } from '../taste/tasteEngine';

export interface CommunityAnimeDiscoveryItem {
  anime: {
    id: string;
    canonicalTitle: string;
    slug: string;
    posterUrl: string;
    score: number | null;
    year: number | null;
    genres: string[];
  };
  community: {
    id: string;
    name: string;
    slug: string;
    iconUrl: string | null;
    memberCount: number;
    isMember: boolean;
  };
  discussionStats: {
    discussionCount: number;
    uniqueParticipantsCount: number;
    latestDiscussionAt: Date;
    engagementScore: number;
  };
  recommendationReason: string;
}

export class CommunityDiscoveryEngine {
  /**
   * Generates community-driven anime discovery feed
   */
  async getCommunityDiscovery(
    userId?: string | null,
    limit = 10
  ): Promise<{
    isPersonalized: boolean;
    items: CommunityAnimeDiscoveryItem[];
    joinedCommunityCount: number;
  }> {
    const isGuest = !userId || userId === 'guest_user';

    // 1. Fetch User Joined Communities (if authenticated)
    let joinedCommunityIds = new Set<string>();
    if (!isGuest) {
      const memberships = await prisma.communityMember.findMany({
        where: { userId: userId!, status: 'ACTIVE' },
        select: { communityId: true },
      });
      joinedCommunityIds = new Set(memberships.map((m) => m.communityId));
    }

    // 2. Fetch Discoverable Discussions linked to Anime
    // Privacy filter: Include discussions from PUBLIC communities, or PRIVATE communities if user is an ACTIVE member
    const discussions = await prisma.discussion.findMany({
      where: {
        animeId: { not: null },
        OR: [
          { community: { visibility: 'PUBLIC' } },
          ...(joinedCommunityIds.size > 0
            ? [{ communityId: { in: Array.from(joinedCommunityIds) } }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: {
        community: {
          select: {
            id: true,
            name: true,
            slug: true,
            iconUrl: true,
            visibility: true,
            memberCount: true,
          },
        },
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
          },
        },
        comments: {
          select: { authorId: true },
        },
      },
    });

    // 3. Aggregate Discussion Graph by Anime & Community with Anti-Spam Weighting
    interface AggregatedCommunityAnime {
      anime: any;
      community: any;
      discussions: any[];
      uniqueAuthors: Set<string>;
      latestDate: Date;
    }

    const map = new Map<string, AggregatedCommunityAnime>();

    for (const d of discussions) {
      if (!d.anime) continue;
      const key = `${d.animeId}_${d.communityId || 'public'}`;

      const existing = map.get(key);
      if (existing) {
        existing.discussions.push(d);
        existing.uniqueAuthors.add(d.authorId);
        d.comments.forEach((c) => existing.uniqueAuthors.add(c.authorId));
        if (d.createdAt > existing.latestDate) {
          existing.latestDate = d.createdAt;
        }
      } else {
        const uniqueAuthors = new Set<string>([d.authorId]);
        d.comments.forEach((c) => uniqueAuthors.add(c.authorId));

        map.set(key, {
          anime: d.anime,
          community: d.community,
          discussions: [d],
          uniqueAuthors,
          latestDate: d.createdAt,
        });
      }
    }

    // 4. Compute Engagement Score with Anti-Spam Unique-User Protection
    const scoredItems: CommunityAnimeDiscoveryItem[] = [];

    for (const entry of map.values()) {
      const discussionCount = entry.discussions.length;
      const uniqueParticipants = entry.uniqueAuthors.size;

      // Anti-Spam formula: Engagement heavily discounts when 1 author creates multiple posts alone
      const participantRatio = Math.min(1.0, uniqueParticipants / Math.max(1, discussionCount));
      const hoursOld = (Date.now() - entry.latestDate.getTime()) / (1000 * 60 * 60);
      const recencyDecay = 1 / (1 + hoursOld / 48); // 48h half-life

      const isMember = entry.community?.id ? joinedCommunityIds.has(entry.community.id) : false;
      const membershipBonus = isMember ? 2.0 : 1.0;

      const engagementScore =
        (uniqueParticipants * 3.0 + discussionCount * 1.0) * participantRatio * recencyDecay * membershipBonus;

      const genres = entry.anime.animeGenres.map((g: any) => g.genre.name);

      let reason = 'Actively discussed in the OTAKUVA community';
      if (isMember && entry.community) {
        reason = `Trending in "${entry.community.name}", a community you joined`;
      } else if (entry.community) {
        reason = `Popular topic in the ${entry.community.name} community`;
      }

      scoredItems.push({
        anime: {
          id: entry.anime.id,
          canonicalTitle: entry.anime.canonicalTitle,
          slug: entry.anime.slug,
          posterUrl: entry.anime.posterUrl,
          score: entry.anime.score,
          year: entry.anime.year,
          genres,
        },
        community: entry.community
          ? {
              id: entry.community.id,
              name: entry.community.name,
              slug: entry.community.slug,
              iconUrl: entry.community.iconUrl,
              memberCount: entry.community.memberCount || 0,
              isMember,
            }
          : {
              id: 'public',
              name: 'Public Discussions',
              slug: 'public',
              iconUrl: null,
              memberCount: 100,
              isMember: false,
            },
        discussionStats: {
          discussionCount,
          uniqueParticipantsCount: uniqueParticipants,
          latestDiscussionAt: entry.latestDate,
          engagementScore: parseFloat(engagementScore.toFixed(2)),
        },
        recommendationReason: reason,
      });
    }

    // Sort Descending by Engagement Score
    scoredItems.sort((a, b) => b.discussionStats.engagementScore - a.discussionStats.engagementScore);

    return {
      isPersonalized: !isGuest && joinedCommunityIds.size > 0,
      items: scoredItems.slice(0, limit),
      joinedCommunityCount: joinedCommunityIds.size,
    };
  }
}

export const communityDiscoveryEngine = new CommunityDiscoveryEngine();
