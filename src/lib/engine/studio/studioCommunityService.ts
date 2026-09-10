/**
 * OTAKUVA STUDIO COMMUNITY SERVICE (PHASE 9.8)
 * 
 * Connects Studios with the OTAKUVA Community Engine:
 * - Studio community discovery (public, restricted, creator-exclusive)
 * - Discussion previews & active community topic aggregation
 * - Membership status resolution (isMember, role)
 * - Private community isolation (zero leakage to non-members)
 * - Admin community creation & linking
 */

import { prisma } from '../../prisma';
import { emitEngineEvent } from '../events/eventEngine';

export interface StudioCommunityFilterOptions {
  visibility?: 'PUBLIC' | 'REQUEST_TO_JOIN' | 'PRIVATE' | 'ALL';
  category?: string;
  sortBy?: 'members' | 'recent' | 'discussions';
  page?: number;
  limit?: number;
}

export interface CreateStudioCommunityInput {
  name: string;
  description: string;
  visibility?: 'PUBLIC' | 'REQUEST_TO_JOIN' | 'PRIVATE';
  joinPolicy?: 'OPEN' | 'APPROVAL_REQUIRED' | 'INVITE_ONLY' | 'CREATOR_ONLY';
  iconUrl?: string;
  bannerUrl?: string;
  category?: string;
}

export class StudioCommunityService {
  /**
   * Resolves a studio record by slug, ID, or name
   */
  async resolveStudio(studioSlugOrId: string) {
    return prisma.studio.findFirst({
      where: {
        OR: [
          { slug: studioSlugOrId },
          { id: studioSlugOrId },
          { name: studioSlugOrId },
        ],
      },
      select: { id: true, name: true, slug: true },
    });
  }

  /**
   * Retrieves communities associated with a studio
   */
  async getStudioCommunities(
    studioSlugOrId: string,
    currentUserId?: string | null,
    options: StudioCommunityFilterOptions = {}
  ) {
    const studio = await this.resolveStudio(studioSlugOrId);
    if (!studio) {
      return { studio: null, communities: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }

    const {
      visibility = 'ALL',
      sortBy = 'members',
      page = 1,
      limit = 20,
    } = options;

    const skip = (Math.max(1, page) - 1) * limit;

    const where: any = {
      studioId: studio.id,
      status: 'ACTIVE',
    };

    if (visibility !== 'ALL') {
      where.visibility = visibility;
    } else {
      // Public callers can only view PUBLIC and REQUEST_TO_JOIN communities unless they are members
      if (!currentUserId) {
        where.visibility = { in: ['PUBLIC', 'REQUEST_TO_JOIN'] };
      }
    }

    const orderBy: any = sortBy === 'recent'
      ? { createdAt: 'desc' }
      : { memberCount: 'desc' };

    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          owner: { select: { id: true, username: true, avatarUrl: true } },
          _count: {
            select: {
              members: true,
              discussions: true,
            },
          },
          discussions: {
            where: { status: 'ACTIVE', spoilerLevel: 'NO_SPOILER' },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              id: true,
              title: true,
              replyCount: true,
              createdAt: true,
              author: { select: { username: true } },
            },
          },
          ...(currentUserId
            ? {
                members: {
                  where: { userId: currentUserId, status: 'ACTIVE' },
                  select: { role: true },
                },
              }
            : {}),
        },
      }),
      prisma.community.count({ where }),
    ]);

    const formatted = communities.map((c: any) => {
      const userMembership = c.members?.[0] || null;
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        iconUrl: c.iconUrl,
        bannerUrl: c.bannerUrl,
        category: c.category,
        communityType: c.communityType,
        visibility: c.visibility,
        joinPolicy: c.joinPolicy,
        memberCount: c.memberCount || c._count?.members || 1,
        discussionCount: c._count?.discussions || 0,
        owner: c.owner,
        isMember: !!userMembership,
        membershipRole: userMembership?.role || null,
        recentDiscussions: c.discussions || [],
        createdAt: c.createdAt,
      };
    });

    return {
      studio,
      communities: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Creates a dedicated community for a Studio
   */
  async createStudioCommunity(
    actorId: string,
    studioId: string,
    input: CreateStudioCommunityInput
  ) {
    const studio = await prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new Error('Studio not found.');

    const {
      name,
      description,
      visibility = 'PUBLIC',
      joinPolicy = 'OPEN',
      iconUrl,
      bannerUrl,
      category = 'ANIME',
    } = input;

    let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let count = 1;
    while (await prisma.community.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${count++}`;
    }

    const community = await prisma.community.create({
      data: {
        name,
        slug,
        description,
        visibility,
        joinPolicy,
        category,
        communityType: 'STUDIO',
        studioId,
        ownerId: actorId,
        iconUrl: iconUrl || studio.imageUrl,
        bannerUrl: bannerUrl || studio.bannerUrl,
        members: {
          create: {
            userId: actorId,
            role: 'OWNER',
            status: 'ACTIVE',
          },
        },
      },
    });

    await prisma.studioAuditLog.create({
      data: {
        studioId,
        actorId,
        action: 'COMMUNITY_LINK',
        newValues: JSON.stringify({ communityId: community.id, name: community.name }),
        reason: `Created official studio community: "${community.name}"`,
      },
    });

    await emitEngineEvent({
      eventType: 'COMMUNITY_CREATED',
      userId: actorId,
      entityType: 'COMMUNITY',
      entityId: community.id,
      metadata: { studioId },
    });

    return community;
  }

  /**
   * Links an existing Community to a Studio (Admin)
   */
  async linkCommunityToStudio(actorId: string, studioId: string, communityId: string) {
    const [studio, community] = await Promise.all([
      prisma.studio.findUnique({ where: { id: studioId } }),
      prisma.community.findUnique({ where: { id: communityId } }),
    ]);

    if (!studio) throw new Error('Studio not found.');
    if (!community) throw new Error('Community not found.');

    const updated = await prisma.community.update({
      where: { id: communityId },
      data: {
        studioId,
        communityType: 'STUDIO',
      },
    });

    await prisma.studioAuditLog.create({
      data: {
        studioId,
        actorId,
        action: 'COMMUNITY_LINK',
        newValues: JSON.stringify({ communityId, name: community.name }),
        reason: `Linked community "${community.name}" to studio`,
      },
    });

    return updated;
  }

  /**
   * Unlinks a Community from a Studio without deleting the community
   */
  async unlinkCommunityFromStudio(actorId: string, studioId: string, communityId: string) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
    });
    if (!community || community.studioId !== studioId) {
      throw new Error('Community not linked to this studio.');
    }

    const updated = await prisma.community.update({
      where: { id: communityId },
      data: {
        studioId: null,
      },
    });

    await prisma.studioAuditLog.create({
      data: {
        studioId,
        actorId,
        action: 'COMMUNITY_UNLINK',
        oldValues: JSON.stringify({ communityId, name: community.name }),
        reason: `Unlinked community "${community.name}" from studio`,
      },
    });

    return updated;
  }
}

export const studioCommunityService = new StudioCommunityService();
