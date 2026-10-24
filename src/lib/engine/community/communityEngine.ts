/**
 * OTAKUVA PRODUCTION COMMUNITY ENGINE (MASTER SYSTEM)
 * 
 * Comprehensive anime culture platform community ecosystem:
 * - 7.1 Community Core + Database (creation, slug collision, public/private visibility, soft-deletion)
 * - 7.2 Membership, Roles & Permissions (OWNER, ADMIN, MODERATOR, MEMBER; join policies OPEN, APPROVAL_REQUIRED, INVITE_ONLY, CREATOR_ONLY)
 * - 7.3 Posts, Threaded Comments, Discussions, Polls, Reactions & Spoilers
 * - 7.4 Moderation, Bans, Mutes, Reports & Audit Logging
 * - 7.5 & 7.6 Real-Time Socket.IO & Persistent Chat Architecture
 * - 7.7 Presence Tracking, Transient Typing Indicators & Read State
 * - 7.8 Creator Communities & External Provider Verification Abstraction
 * - 7.9 Anime ↔ Season ↔ Episode Contextual Discussion Integration
 * - 7.10 Notifications & Event Stream Integration
 * - 7.11 Security, Mass-Assignment Protection, IDOR Guards & Rate Limits
 */

import { randomBytes } from 'crypto';
import { prisma } from '../../prisma';
import { notifyFollowersOfDiscussion } from '../../social/followService';
import { generateSlug } from '../../normalizers';
import { emitEngineEvent } from '../events/eventEngine';
import { refreshCommunityAggregatesSafe } from '../../badges/countingService';
import { getChatAuthorMeta } from '../../community/chatAuthorMeta';
import { isInviteOnly, resolveNewCommunityAccess, resolveVisibilityChange } from '../../community/communityPolicy';
import { issueInvitation, type InvitationDto } from '../../community/invitations';

export const COMMUNITY_ENGINE_VERSION = 2;

export type CommunityType =
  | 'ANIME'
  | 'SEASON'
  | 'GENRE'
  | 'STUDIO'
  | 'CREATOR'
  | 'GENERAL'
  | 'CREATOR_EXCLUSIVE';

export type CommunityVisibility = 'PUBLIC' | 'REQUEST_TO_JOIN' | 'PRIVATE';
export type CommunityJoinPolicy = 'OPEN' | 'APPROVAL_REQUIRED' | 'INVITE_ONLY' | 'CREATOR_ONLY';
export type CommunityStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';
export type CommunityRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type MembershipStatus = 'ACTIVE' | 'PENDING' | 'BANNED' | 'LEFT' | 'INVITED';

export type PostType =
  | 'TEXT'
  | 'DISCUSSION'
  | 'QUESTION'
  | 'ANNOUNCEMENT'
  | 'POLL'
  | 'LINK'
  | 'MEDIA'
  | 'THEORY'
  | 'REACTION'
  | 'EPISODE_DISCUSSION';

export type SpoilerLevel = 'NO_SPOILER' | 'ANIME_SPOILER' | 'EPISODE_SPOILER' | 'MANGA_SPOILER';

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'HATE'
  | 'SPOILER_MISUSE'
  | 'PIRACY'
  | 'ABUSE'
  | 'MISINFORMATION'
  | 'OTHER';

export interface CreateCommunityInput {
  name: string;
  description: string;
  category?: string;
  communityType?: CommunityType;
  visibility?: CommunityVisibility;
  joinPolicy?: CommunityJoinPolicy;
  iconUrl?: string | null;
  iconSource?: 'UPLOAD' | 'URL';
  bannerUrl?: string | null;
  bannerSource?: 'UPLOAD' | 'URL';
  animeId?: string | null;
  /** Genre ids or slugs the community is about (max COMMUNITY_GENRES_MAX). */
  genreIds?: string[];
  rules?: { title: string; content: string }[];
}

export interface UpdateCommunityInput {
  name?: string;
  description?: string;
  category?: string;
  communityType?: CommunityType;
  visibility?: CommunityVisibility;
  joinPolicy?: CommunityJoinPolicy;
  status?: CommunityStatus;
  iconUrl?: string | null;
  iconSource?: 'UPLOAD' | 'URL';
  bannerUrl?: string | null;
  bannerSource?: 'UPLOAD' | 'URL';
  /** Anime id or slug; null unlinks. Omitted leaves it as is. */
  animeId?: string | null;
  /** Replaces the community's genres when given. */
  genreIds?: string[];
  rules?: { title: string; content: string }[];
}

export interface ListCommunitiesOptions {
  filter?: string; // 'all', 'trending', 'popular', 'growing', 'new', 'joined'
  category?: string;
  communityType?: string;
  animeId?: string;
  /** Genre slug: communities tagged with it, or about an anime in it. */
  genre?: string;
  query?: string;
  page?: number;
  limit?: number;
  userId?: string | null;
}

export interface CreatePostInput {
  authorId: string;
  communityId: string;
  channelId?: string;
  title: string;
  body: string;
  type?: PostType;
  spoilerLevel?: SpoilerLevel;
  animeId?: string;
  episodeId?: string;
  poll?: {
    question: string;
    options: string[];
    expiresInDays?: number;
  };
}

export type { CreateCommentInput } from './commentService';

// In-Memory Presence & Typing State Store (Non-Persistent / Transient)
interface PresenceUser {
  userId: string;
  status: 'ONLINE' | 'AWAY';
  lastSeen: number;
}
const communityPresenceMap = new Map<string, Map<string, PresenceUser>>();
const communityTypingMap = new Map<string, Map<string, { username: string; timestamp: number }>>();

/**
 * =========================================================================
 * 1. CENTRALIZED AUTHORIZATION SERVICE
 * =========================================================================
 */

export function canCreateCommunity(userId?: string | null): boolean {
  return Boolean(userId && userId.trim().length > 0);
}

export function canViewCommunity(
  community: { visibility: string; status?: string; ownerId: string },
  userMembership?: { status: string; role: string } | null,
  userId?: string | null
): boolean {
  if (community.status === 'DELETED') {
    return false;
  }

  // Public & Request-to-join communities can be discovered and viewed
  if (community.visibility === 'PUBLIC' || community.visibility === 'REQUEST_TO_JOIN') {
    return true;
  }

  // Private community requires active authenticated membership or ownership
  if (!userId) return false;
  if (community.ownerId === userId) return true;
  if (userMembership && userMembership.status === 'ACTIVE') return true;

  return false;
}

/**
 * Server-side read gate for a community's content (posts, members,
 * discussions, comments). Every read route resolves access through this
 * instead of re-deriving it, so PRIVATE content is never served to a
 * non-member no matter which endpoint is asked. A ban outranks a member row
 * that is still marked ACTIVE.
 */
export async function canUserViewCommunityContent(
  community: { id: string; visibility: string; status?: string; ownerId: string },
  userId?: string | null
): Promise<boolean> {
  if (!userId) return canViewCommunity(community, null, null);

  const [membership, ban] = await Promise.all([
    prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
      select: { status: true, role: true },
    }),
    prisma.communityBan.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
    }),
  ]);

  const banActive = Boolean(ban && (!ban.expiresAt || ban.expiresAt.getTime() > Date.now()));
  return canViewCommunity(community, banActive ? null : membership, userId);
}

/**
 * Prisma filter matching discussions a viewer may read in cross-community
 * listings: anything outside a community, anything in a community that is not
 * PRIVATE, and PRIVATE communities the viewer owns or is an active,
 * unbanned member of.
 */
export function readableDiscussionsFilter(userId?: string | null) {
  const openCommunity = { community: { visibility: { not: 'PRIVATE' }, status: { not: 'DELETED' } } };
  if (!userId) {
    return { OR: [{ communityId: null }, openCommunity] };
  }
  return {
    OR: [
      { communityId: null },
      openCommunity,
      {
        community: {
          status: { not: 'DELETED' },
          bans: { none: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } },
          OR: [{ ownerId: userId }, { members: { some: { userId, status: 'ACTIVE' } } }],
        },
      },
    ],
  };
}

export async function getMemberPermission(userId: string, communityId: string) {
  const member = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId,
        userId,
      },
    },
    include: { community: true },
  });

  const isBanned = await prisma.communityBan.findUnique({
    where: {
      communityId_userId: {
        communityId,
        userId,
      },
    },
  });

  const isMuted = Boolean(
    member?.mutedUntil && new Date(member.mutedUntil).getTime() > Date.now()
  );

  const role: CommunityRole | null =
    (member?.role as CommunityRole) ||
    (member?.community?.ownerId === userId ? 'OWNER' : null);
  const status: MembershipStatus | null =
    (member?.status as MembershipStatus) || null;

  const isOwner = role === 'OWNER' || member?.community?.ownerId === userId;
  const isAdmin = isOwner || role === 'ADMIN';
  const isModerator = isAdmin || role === 'MODERATOR';

  return {
    isMember: Boolean(member && status === 'ACTIVE'),
    isBanned: Boolean(isBanned),
    isMuted,
    role,
    status,
    isOwner,
    isAdmin,
    isModerator,
    canPost: Boolean(member && status === 'ACTIVE' && !isBanned && !isMuted),
    canChat: Boolean(member && status === 'ACTIVE' && !isBanned && !isMuted),
    canModerate: isModerator,
    canManageChannels: isModerator,
    canManageSettings: isAdmin,
    canManageMembers: isAdmin,
    canEdit: isAdmin,
    canDelete: isOwner,
    canTransferOwnership: isOwner,
  };
}

export async function canEditCommunity(userId: string, communityId: string): Promise<boolean> {
  const perm = await getMemberPermission(userId, communityId);
  return perm.canEdit;
}

export async function canDeleteCommunity(userId: string, communityId: string): Promise<boolean> {
  const perm = await getMemberPermission(userId, communityId);
  return perm.canDelete;
}

export async function canModerateCommunity(userId: string, communityId: string): Promise<boolean> {
  const perm = await getMemberPermission(userId, communityId);
  return perm.canModerate;
}

/**
 * =========================================================================
 * 2. COMMUNITY CORE CRUD (ATOMIC TRANSACTION INTEGRITY)
 * =========================================================================
 */

export const COMMUNITY_GENRES_MAX = 5;

/** Anime id or slug -> stored anime id. Unknown values are rejected, never guessed. */
async function resolveCommunityAnime(animeId: string): Promise<string> {
  const anime = await prisma.anime.findFirst({ where: { OR: [{ id: animeId }, { slug: animeId }] }, select: { id: true } });
  if (!anime) throw new Error('Validation: the linked anime could not be found');
  return anime.id;
}

/** Genre ids or slugs -> stored genre ids (deduplicated, capped). */
async function resolveCommunityGenres(raw: unknown): Promise<string[]> {
  if (!Array.isArray(raw)) return [];
  const keys = Array.from(new Set(raw.filter((g): g is string => typeof g === 'string' && g.trim() !== '').map((g) => g.trim())));
  if (keys.length > COMMUNITY_GENRES_MAX) throw new Error(`Validation: pick at most ${COMMUNITY_GENRES_MAX} genres`);
  if (keys.length === 0) return [];
  const genres = await prisma.genre.findMany({ where: { OR: [{ id: { in: keys } }, { slug: { in: keys } }] }, select: { id: true } });
  if (genres.length !== keys.length) throw new Error('Validation: one of the genres could not be found');
  return genres.map((g) => g.id);
}

export async function createCommunity(userId: string, input: CreateCommunityInput) {
  if (!canCreateCommunity(userId)) {
    throw new Error('Authentication required to create a community');
  }

  const {
    name,
    description,
    category = 'ANIME',
    iconUrl,
    iconSource = 'URL',
    bannerUrl,
    bannerSource = 'URL',
    animeId,
    rules = [],
  } = input;

  if (!name || name.trim().length < 3) {
    throw new Error('Community name must be at least 3 characters');
  }

  if (name.trim().length > 100) {
    throw new Error('Community name cannot exceed 100 characters');
  }

  if (!description || description.trim().length < 10) {
    throw new Error('Description must be at least 10 characters');
  }

  if (description.trim().length > 2000) {
    throw new Error('Description cannot exceed 2000 characters');
  }

  // Visibility, join policy and type are decided here from the creator's real
  // role — never taken from the request as-is. Members-only (PRIVATE) needs a
  // CREATOR account.
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!actor) throw new Error('Authentication required to create a community');
  const { visibility, joinPolicy, communityType } = resolveNewCommunityAccess(input, actor.role);

  // Safe unique slug generation with collision handling
  const baseSlug = generateSlug(name);
  let uniqueSlug = baseSlug;
  let counter = 1;

  while (await prisma.community.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  const verifiedAnimeId = animeId ? await resolveCommunityAnime(animeId) : null;
  const genreIds = await resolveCommunityGenres(input.genreIds);

  // Atomic transaction
  const community = await prisma.$transaction(async (tx) => {
    const created = await tx.community.create({
      data: {
        ownerId: userId,
        name: name.trim(),
        slug: uniqueSlug,
        description: description.trim(),
        category: category.toUpperCase(),
        communityType,
        visibility,
        joinPolicy,
        status: 'ACTIVE',
        iconUrl: iconUrl || null,
        iconSource,
        bannerUrl: bannerUrl || null,
        bannerSource,
        animeId: verifiedAnimeId,
        genres: genreIds.length ? { create: genreIds.map((genreId) => ({ genreId })) } : undefined,
        memberCount: 1,
        rules: Array.isArray(rules) && rules.length > 0 ? {
          create: rules
            .filter((r) => r.title?.trim() && r.content?.trim())
            .map((r, i) => ({
              position: i,
              title: r.title.trim(),
              content: r.content.trim(),
            })),
        } : undefined,
        channels: {
          create: [
            { name: 'general', slug: 'general', type: 'TEXT', position: 0 },
            { name: 'on-topic', slug: 'on-topic', type: 'TEXT', position: 1 },
            { name: 'discussions', slug: 'discussions', type: 'TEXT', position: 2 },
            { name: 'announcements', slug: 'announcements', type: 'ANNOUNCEMENT', position: 3 },
          ],
        },
        members: {
          create: {
            userId,
            role: 'OWNER',
            status: 'ACTIVE',
            creatorVerified: communityType === 'CREATOR' || communityType === 'CREATOR_EXCLUSIVE',
          },
        },
      },
      include: {
        channels: true,
        rules: true,
        members: true,
        owner: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Members-only: the first invitation is issued in the same transaction,
    // so a private community never exists without a way in.
    const firstInvite = visibility === 'PRIVATE' ? await issueInvitation(tx, { communityId: created.id, userId }) : null;
    return { created, firstInvite };
  });

  await emitEngineEvent({
    eventType: 'COMMUNITY_CREATED',
    userId,
    entityType: 'COMMUNITY',
    entityId: community.created.id,
    metadata: { name: community.created.name, slug: community.created.slug, visibility, communityType },
  });

  // The access key is in this response only — it is never stored in plaintext.
  const invitation: (InvitationDto & { key: string }) | null = community.firstInvite
    ? { ...community.firstInvite.invitation, key: community.firstInvite.key }
    : null;
  return { ...community.created, invitation };
}

export async function ensureDefaultCommunityChannels(communityId: string) {
  const existing = await prisma.communityChannel.findMany({
    where: { communityId },
  });
  const existingSlugs = new Set(existing.map((c) => c.slug));
  const defaults = [
    { name: 'general', slug: 'general', type: 'TEXT', position: 0 },
    { name: 'on-topic', slug: 'on-topic', type: 'TEXT', position: 1 },
    { name: 'discussions', slug: 'discussions', type: 'TEXT', position: 2 },
    { name: 'announcements', slug: 'announcements', type: 'ANNOUNCEMENT', position: 3 },
  ];

  for (const def of defaults) {
    if (!existingSlugs.has(def.slug)) {
      await prisma.communityChannel.create({
        data: {
          communityId,
          name: def.name,
          slug: def.slug,
          type: def.type,
          position: def.position,
        },
      });
    }
  }
}

export async function createCommunityChannel(
  userId: string,
  communityId: string,
  data: { name: string; slug?: string; type?: string }
) {
  const perm = await getMemberPermission(userId, communityId);
  if (!perm.canManageChannels) {
    throw new Error('Unauthorized: Only community owner or moderators can create channels');
  }

  const cleanName = data.name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/^-+|-+$/g, '');
  if (!cleanName) {
    throw new Error('Channel name is invalid');
  }

  const slug = data.slug || cleanName;
  const count = await prisma.communityChannel.count({ where: { communityId } });

  const channel = await prisma.communityChannel.create({
    data: {
      communityId,
      name: cleanName,
      slug,
      type: data.type || 'TEXT',
      position: count,
    },
  });

  return channel;
}

export async function getCommunityByIdOrSlug(idOrSlug: string, userId?: string | null) {
  let community = await prisma.community.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      status: { notIn: ['DELETED'] },
    },
    include: {
      owner: { select: { id: true, username: true, avatarUrl: true } },
      channels: {
        select: { id: true, name: true, slug: true, type: true, position: true },
        orderBy: { position: 'asc' },
      },
      rules: {
        select: { id: true, position: true, title: true, content: true },
        orderBy: { position: 'asc' },
      },
      anime: {
        select: { id: true, canonicalTitle: true, slug: true, posterUrl: true, bannerUrl: true },
      },
      genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
      members: {
        where: { status: 'ACTIVE' },
        take: 20,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: 'desc' },
      },
      _count: {
        select: { members: true, discussions: true },
      },
    },
  });

  if (!community) {
    return null;
  }

  if (!community.channels || community.channels.length === 0 || !community.channels.some((c) => c.slug === 'on-topic')) {
    await ensureDefaultCommunityChannels(community.id);
    community.channels = await prisma.communityChannel.findMany({
      where: { communityId: community.id },
      select: { id: true, name: true, slug: true, type: true, position: true },
      orderBy: { position: 'asc' },
    });
  }

  let userRole: string | null = null;
  let membershipStatus: string | null = null;

  if (userId) {
    // Membership lives in two places: an approved member has a CommunityMember
    // row, while someone awaiting approval only has a CommunityJoinRequest.
    // Reading just the member table reported PENDING users as non-members, so
    // their "Request Pending" button reverted to "Join" on every refresh.
    const [membership, joinRequest, ban] = await Promise.all([
      prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId } },
      }),
      prisma.communityJoinRequest.findUnique({
        where: { communityId_userId: { communityId: community.id, userId } },
      }),
      prisma.communityBan.findUnique({
        where: { communityId_userId: { communityId: community.id, userId } },
      }),
    ]);

    if (ban) {
      // A ban outranks any membership or request record.
      userRole = null;
      membershipStatus = 'BANNED';
    } else if (membership && membership.status === 'ACTIVE') {
      userRole = membership.role;
      membershipStatus = membership.status;
    } else if (community.ownerId === userId) {
      userRole = 'OWNER';
      membershipStatus = 'ACTIVE';
    } else if (joinRequest && joinRequest.status === 'PENDING') {
      membershipStatus = 'PENDING';
    } else if (joinRequest && joinRequest.status === 'REJECTED') {
      membershipStatus = 'REJECTED';
    } else if (membership) {
      // BANNED/LEFT/PENDING rows on the member table itself.
      userRole = membership.role;
      membershipStatus = membership.status;
    }
  }

  const userMembership = membershipStatus ? { role: userRole || 'MEMBER', status: membershipStatus } : null;

  const allowed = canViewCommunity(community, userMembership, userId);
  if (!allowed) {
    return {
      id: community.id,
      name: community.name,
      slug: community.slug,
      description: 'This is a private community. Membership is required to view discussions and members.',
      category: community.category,
      communityType: community.communityType,
      visibility: community.visibility,
      joinPolicy: community.joinPolicy,
      status: community.status,
      iconUrl: community.iconUrl,
      bannerUrl: community.bannerUrl,
      memberCount: community._count.members || community.memberCount,
      discussionCount: 0,
      createdAt: community.createdAt.toISOString(),
      owner: community.owner,
      userRole,
      membershipStatus,
      isRestricted: true,
      currentUserMembership: userMembership,
    };
  }

  return {
    ...community,
    memberCount: community._count.members || community.memberCount,
    discussionCount: community._count.discussions,
    userRole,
    membershipStatus,
    currentUserMembership: userMembership,
    isRestricted: false,
  };
}

export async function listDiscoverableCommunities(options: ListCommunitiesOptions = {}) {
  const {
    filter = 'all',
    category,
    communityType,
    animeId,
    genre,
    query,
    page = 1,
    limit = 30,
    userId,
  } = options;

  const skip = (Math.max(1, page) - 1) * limit;

  const where: any = {
    status: { notIn: ['DELETED', 'ARCHIVED'] },
  };

  if (filter === 'joined' && userId) {
    where.members = {
      some: {
        userId,
        status: 'ACTIVE',
      },
    };
  } else {
    where.visibility = { in: ['PUBLIC', 'REQUEST_TO_JOIN'] };
  }

  if (category && category.toUpperCase() !== 'ALL') {
    where.category = category.toUpperCase();
  }

  if (communityType && communityType.toUpperCase() !== 'ALL') {
    where.communityType = communityType.toUpperCase();
  }

  if (animeId) {
    where.animeId = animeId;
  }

  const and: any[] = [];
  if (genre && genre.trim()) {
    const g = genre.trim();
    and.push({
      OR: [
        { genres: { some: { genre: { slug: g } } } },
        { anime: { animeGenres: { some: { genre: { slug: g } } } } },
      ],
    });
  }

  if (query && query.trim()) {
    // Postgres `contains` is case-sensitive unless told otherwise.
    const q = query.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { anime: { canonicalTitle: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }
  if (and.length) where.AND = and;

  let orderBy: any = { memberCount: 'desc' };
  if (filter === 'new') {
    orderBy = { createdAt: 'desc' };
  } else if (filter === 'popular' || filter === 'trending') {
    orderBy = [{ memberCount: 'desc' }, { createdAt: 'desc' }];
  }

  const [communities, total] = await Promise.all([
    prisma.community.findMany({
      where,
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        channels: { select: { id: true, name: true, slug: true, type: true } },
        rules: { select: { id: true, title: true, content: true } },
        anime: { select: { id: true, canonicalTitle: true, slug: true, posterUrl: true } },
        genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { members: true, discussions: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.community.count({ where }),
  ]);

  let userMembershipMap: Record<string, { role: string; status: string }> = {};
  if (userId && communities.length > 0) {
    const memberships = await prisma.communityMember.findMany({
      where: {
        userId,
        communityId: { in: communities.map((c) => c.id) },
      },
    });
    memberships.forEach((m) => {
      userMembershipMap[m.communityId] = { role: m.role, status: m.status };
    });
  }

  const formatted = communities.map((c) => {
    const membership = userMembershipMap[c.id] || null;
    return {
      id: c.id,
      ownerId: c.ownerId,
      name: c.name,
      slug: c.slug,
      description: c.description,
      iconUrl: c.iconUrl,
      iconSource: c.iconSource || 'URL',
      bannerUrl: c.bannerUrl,
      bannerSource: c.bannerSource || 'URL',
      category: c.category,
      communityType: c.communityType,
      visibility: c.visibility,
      joinPolicy: c.joinPolicy,
      status: c.status,
      memberCount: c._count.members || c.memberCount,
      discussionCount: c._count.discussions,
      createdAt: c.createdAt.toISOString(),
      owner: c.owner,
      channels: c.channels,
      rules: c.rules,
      anime: c.anime,
      genres: c.genres.map((g) => g.genre),
      currentUserMembership: membership,
      membershipStatus: membership ? membership.status : null,
    };
  });

  return {
    communities: formatted,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateCommunity(
  userId: string,
  communityIdOrSlug: string,
  input: UpdateCommunityInput
) {
  const community = await prisma.community.findFirst({
    where: {
      OR: [{ id: communityIdOrSlug }, { slug: communityIdOrSlug }],
      status: { notIn: ['DELETED'] },
    },
  });

  if (!community) {
    throw new Error('Community not found');
  }

  const perm = await getMemberPermission(userId, community.id);
  if (!perm.canEdit) {
    throw new Error('Unauthorized: Only community owners and administrators can update settings');
  }

  const updateData: any = {};

  if (input.name && input.name.trim().length >= 3) {
    updateData.name = input.name.trim();
  }
  if (input.description && input.description.trim().length >= 10) {
    updateData.description = input.description.trim();
  }
  if (input.category) updateData.category = input.category.toUpperCase();
  // Who can join is the owner's decision, checked against their real role
  // (members-only needs CREATOR); join policy always follows visibility.
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (input.visibility) {
    const change = resolveVisibilityChange(input.visibility, { userId, role: actor?.role ?? 'USER' }, community);
    if (change) Object.assign(updateData, change);
  }
  if (input.communityType && !updateData.communityType) {
    const type = String(input.communityType).toUpperCase();
    const creatorTypes = ['CREATOR', 'CREATOR_EXCLUSIVE'];
    if (creatorTypes.includes(type) || creatorTypes.includes(community.communityType)) {
      // Creator types follow visibility (set above); not changed directly.
    } else if (['ANIME', 'SEASON', 'GENRE', 'STUDIO', 'GENERAL'].includes(type)) {
      updateData.communityType = type;
    } else {
      throw new Error('Validation: unknown community type');
    }
  }
  if (input.status) {
    const status = String(input.status).toUpperCase();
    // Deleting goes through DELETE (owner only); settings can only archive/restore.
    if (!['ACTIVE', 'ARCHIVED'].includes(status)) throw new Error('Validation: status must be ACTIVE or ARCHIVED');
    updateData.status = status;
  }
  if (input.iconUrl !== undefined) {
    updateData.iconUrl = input.iconUrl;
    if (input.iconSource) updateData.iconSource = input.iconSource;
  }
  if (input.bannerUrl !== undefined) {
    updateData.bannerUrl = input.bannerUrl;
    if (input.bannerSource) updateData.bannerSource = input.bannerSource;
  }
  if (input.animeId !== undefined) {
    updateData.animeId = input.animeId ? await resolveCommunityAnime(input.animeId) : null;
  }
  const genreIds = input.genreIds !== undefined ? await resolveCommunityGenres(input.genreIds) : null;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.community.update({
      where: { id: community.id },
      data: updateData,
      include: {
        channels: true,
        rules: true,
        owner: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    if (genreIds) {
      await tx.communityGenre.deleteMany({ where: { communityId: community.id } });
      if (genreIds.length) {
        await tx.communityGenre.createMany({ data: genreIds.map((genreId) => ({ communityId: community.id, genreId })) });
      }
    }

    if (Array.isArray(input.rules)) {
      await tx.communityRule.deleteMany({ where: { communityId: community.id } });
      for (let i = 0; i < input.rules.length; i++) {
        const r = input.rules[i];
        if (r.title?.trim() && r.content?.trim()) {
          await tx.communityRule.create({
            data: {
              communityId: community.id,
              position: i,
              title: r.title.trim(),
              content: r.content.trim(),
            },
          });
        }
      }
    }

    return res;
  });

  await emitEngineEvent({
    eventType: 'COMMUNITY_UPDATED',
    userId,
    entityType: 'COMMUNITY',
    entityId: community.id,
    metadata: { name: updated.name, visibility: updated.visibility },
  });

  return updated;
}

export async function deleteCommunity(userId: string, communityIdOrSlug: string) {
  const community = await prisma.community.findFirst({
    where: {
      OR: [{ id: communityIdOrSlug }, { slug: communityIdOrSlug }],
      status: { notIn: ['DELETED'] },
    },
  });

  if (!community) {
    throw new Error('Community not found');
  }

  const perm = await getMemberPermission(userId, community.id);
  if (!perm.canDelete) {
    throw new Error('Unauthorized: Only the community owner can delete the community');
  }

  const deleted = await prisma.community.update({
    where: { id: community.id },
    data: {
      status: 'DELETED',
      deletedAt: new Date(),
    },
  });

  await emitEngineEvent({
    eventType: 'COMMUNITY_DELETED',
    userId,
    entityType: 'COMMUNITY',
    entityId: community.id,
    metadata: { name: community.name, slug: community.slug },
  });

  return { success: true, id: deleted.id, status: 'DELETED' };
}

/**
 * =========================================================================
 * 3. MEMBERSHIP LIFECYCLE & ROLES
 * =========================================================================
 */

/**
 * Notifies the community creator that someone asked to join.
 *
 * Recipients are exactly the people who can act on the request: the creator
 * (always), plus any ADMIN members, who share approval rights. MODERATORs are
 * deliberately excluded — getMemberPermission grants canManageMembers to
 * admins and owners only, so notifying a moderator would send them to a view
 * that answers 403.
 *
 * This fires on one event only: the creation of a new PENDING join request.
 * Repeat clicks on an existing pending request return early before reaching
 * here, so a creator is never notified twice for the same request.
 *
 * Notification failure must never fail the join request itself: the request
 * row is already committed, and a missing notification is recoverable from the
 * pending list, so this logs and moves on.
 */
async function notifyCommunityManagers(
  communityId: string,
  communitySlug: string,
  communityName: string,
  requesterId: string
): Promise<void> {
  try {
    const [requester, managers, community] = await Promise.all([
      prisma.user.findUnique({ where: { id: requesterId }, select: { username: true } }),
      prisma.communityMember.findMany({
        where: {
          communityId,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { userId: true },
      }),
      prisma.community.findUnique({ where: { id: communityId }, select: { ownerId: true } }),
    ]);

    const recipients = new Set(managers.map((m) => m.userId));
    if (community?.ownerId) recipients.add(community.ownerId);
    // A user never needs to be told about their own request.
    recipients.delete(requesterId);

    if (recipients.size === 0) return;

    const who = requester?.username ? `@${requester.username}` : 'A user';

    await prisma.notification.createMany({
      data: Array.from(recipients).map((userId) => ({
        userId,
        type: 'COMMUNITY_JOIN_REQUEST',
        title: 'New join request',
        body: `${who} requested to join ${communityName}.`,
        linkUrl: `/community/${communitySlug}?tab=requests`,
      })),
    });
  } catch (err) {
    console.error('[community] Failed to notify managers of join request', {
      communityId,
      requesterId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function joinCommunity(
  userId: string,
  communitySlug: string,
  verificationData?: { provider: string; token: string }
) {
  const community = await prisma.community.findFirst({
    where: { OR: [{ slug: communitySlug }, { id: communitySlug }] },
  });

  if (!community || community.status === 'DELETED') {
    throw new Error('Community not found');
  }

  // Check ban status
  const ban = await prisma.communityBan.findUnique({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId,
      },
    },
  });
  if (ban) {
    throw new Error('You are banned from this community');
  }

  // Members-only communities are joined only through an invitation link +
  // key (src/lib/community/invitations.ts). Knowing the slug or sending any
  // "verification" token is not enough — this path used to accept any
  // token unchecked, and PRIVATE+OPEN communities fell through to a plain join.
  void verificationData;
  const creatorVerified = false;
  const verificationProvider: string | null = null;
  if (isInviteOnly(community)) {
    const existing = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
    });
    if (existing?.status === 'ACTIVE') {
      return { success: true, status: 'ACTIVE', role: existing.role, memberCount: community.memberCount };
    }
    throw new Error('Forbidden: this community is members-only. Join with the invitation link and access key from its creator.');
  }

  // Approval required workflow
  if (community.joinPolicy === 'APPROVAL_REQUIRED' || community.visibility === 'REQUEST_TO_JOIN') {
    // Already an approved member — nothing to request. Return the canonical
    // state instead of downgrading an active membership back to PENDING.
    const existingMember = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
    });
    if (existingMember && existingMember.status === 'ACTIVE') {
      return {
        success: true,
        status: 'ACTIVE',
        role: existingMember.role,
        memberCount: community.memberCount,
      };
    }

    const existingRequest = await prisma.communityJoinRequest.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
    });

    // Repeated clicks must not stack requests or reset the queue position.
    // The unique constraint already guarantees one row per (community, user);
    // this keeps an existing PENDING row untouched rather than re-stamping it.
    if (existingRequest && existingRequest.status === 'PENDING') {
      return {
        success: true,
        status: 'PENDING',
        role: 'MEMBER',
        memberCount: community.memberCount,
        alreadyRequested: true,
      };
    }

    await prisma.communityJoinRequest.upsert({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId,
        },
      },
      update: { status: 'PENDING', createdAt: new Date(), reviewedAt: null, reviewedBy: null },
      create: {
        communityId: community.id,
        userId,
        status: 'PENDING',
      },
    });

    await notifyCommunityManagers(community.id, community.slug, community.name, userId);

    await emitEngineEvent({
      eventType: 'JOIN_REQUEST_CREATED',
      userId,
      entityType: 'COMMUNITY',
      entityId: community.id,
    });

    return { success: true, status: 'PENDING', role: 'MEMBER', memberCount: community.memberCount };
  }

  // Active membership join
  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.communityMember.upsert({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId,
        },
      },
      update: {
        status: 'ACTIVE',
        joinedAt: new Date(),
        creatorVerified,
        verificationProvider,
      },
      create: {
        communityId: community.id,
        userId,
        role: 'MEMBER',
        status: 'ACTIVE',
        creatorVerified,
        verificationProvider,
      },
    });

    const totalMembers = await tx.communityMember.count({
      where: { communityId: community.id, status: 'ACTIVE' },
    });

    await tx.community.update({
      where: { id: community.id },
      data: { memberCount: totalMembers },
    });

    return { membership, totalMembers };
  });

  await refreshCommunityAggregatesSafe(community.id);

  await emitEngineEvent({
    eventType: 'MEMBER_JOINED',
    userId,
    entityType: 'COMMUNITY',
    entityId: community.id,
    metadata: { communityName: community.name },
  });

  return {
    success: true,
    status: 'ACTIVE',
    role: result.membership.role,
    memberCount: result.totalMembers,
  };
}

export async function leaveCommunity(userId: string, communitySlug: string) {
  const community = await prisma.community.findFirst({
    where: { OR: [{ slug: communitySlug }, { id: communitySlug }] },
  });

  if (!community) {
    throw new Error('Community not found');
  }

  if (community.ownerId === userId) {
    throw new Error('Community owner cannot leave without transferring ownership');
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.communityMember.deleteMany({
      where: {
        communityId: community.id,
        userId,
      },
    });

    const totalMembers = await tx.communityMember.count({
      where: { communityId: community.id, status: 'ACTIVE' },
    });

    await tx.community.update({
      where: { id: community.id },
      data: { memberCount: totalMembers },
    });

    return { totalMembers };
  });

  await refreshCommunityAggregatesSafe(community.id);

  await emitEngineEvent({
    eventType: 'MEMBER_LEFT',
    userId,
    entityType: 'COMMUNITY',
    entityId: community.id,
  });

  return {
    success: true,
    status: null,
    memberCount: result.totalMembers,
  };
}

export async function reviewJoinRequest(
  moderatorId: string,
  communityId: string,
  targetUserId: string,
  action: 'APPROVE' | 'REJECT'
) {
  const perm = await getMemberPermission(moderatorId, communityId);
  if (!perm.canManageMembers) {
    throw new Error('Unauthorized: Admin privileges required to review join requests');
  }

  // The permission check above is scoped to this communityId, so an admin of
  // another community fails here rather than reaching another community's
  // request. Confirm the request exists and is still actionable before
  // mutating: without this, a second approval would throw a raw Prisma error
  // and a already-decided request could be silently re-decided.
  const request = await prisma.communityJoinRequest.findUnique({
    where: { communityId_userId: { communityId, userId: targetUserId } },
  });
  if (!request) {
    throw new Error('Join request not found');
  }
  if (request.status !== 'PENDING') {
    throw new Error(`Join request has already been ${request.status.toLowerCase()}`);
  }

  if (action === 'APPROVE') {
    await prisma.$transaction(async (tx) => {
      await tx.communityJoinRequest.update({
        where: { communityId_userId: { communityId, userId: targetUserId } },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: moderatorId },
      });

      await tx.communityMember.upsert({
        where: { communityId_userId: { communityId, userId: targetUserId } },
        update: { status: 'ACTIVE', joinedAt: new Date() },
        create: { communityId, userId: targetUserId, role: 'MEMBER', status: 'ACTIVE' },
      });

      const total = await tx.communityMember.count({
        where: { communityId, status: 'ACTIVE' },
      });

      await tx.community.update({
        where: { id: communityId },
        data: { memberCount: total },
      });

      // Notification to user
      const approvedCommunity = await tx.community.findUnique({
        where: { id: communityId },
        select: { name: true, slug: true },
      });

      await tx.notification.create({
        data: {
          userId: targetUserId,
          type: 'COMMUNITY_JOIN_APPROVED',
          title: 'Join Request Approved',
          body: approvedCommunity
            ? `Your request to join ${approvedCommunity.name} was approved.`
            : 'Your request to join the community has been approved!',
          linkUrl: approvedCommunity ? `/community/${approvedCommunity.slug}` : null,
        },
      });
    });

    await refreshCommunityAggregatesSafe(communityId);

    await emitEngineEvent({
      eventType: 'JOIN_REQUEST_APPROVED',
      userId: moderatorId,
      entityType: 'COMMUNITY',
      entityId: communityId,
      metadata: { targetUserId },
    });

    return { success: true, status: 'ACTIVE' };
  } else {
    await prisma.communityJoinRequest.update({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: moderatorId },
    });

    // Mirror the approval path so the outcome is visible in the same place,
    // rather than the request silently disappearing from the user's view.
    try {
      const rejectedCommunity = await prisma.community.findUnique({
        where: { id: communityId },
        select: { name: true, slug: true },
      });
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          type: 'COMMUNITY_JOIN_REJECTED',
          title: 'Join Request Declined',
          body: rejectedCommunity
            ? `Your request to join ${rejectedCommunity.name} was not approved.`
            : 'Your request to join the community was not approved.',
          linkUrl: rejectedCommunity ? `/community/${rejectedCommunity.slug}` : null,
        },
      });
    } catch (err) {
      console.error('[community] Failed to notify user of join rejection', {
        communityId,
        targetUserId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await emitEngineEvent({
      eventType: 'JOIN_REQUEST_REJECTED',
      userId: moderatorId,
      entityType: 'COMMUNITY',
      entityId: communityId,
      metadata: { targetUserId },
    });

    return { success: true, status: 'REJECTED' };
  }
}

/**
 * Pending join requests for a community, for the owner/admin review UI.
 * Authorization is the caller's responsibility boundary — enforced here rather
 * than in the route so every caller gets the same check.
 */
export async function listJoinRequests(
  moderatorId: string,
  communityIdOrSlug: string,
  status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING'
) {
  const community = await prisma.community.findFirst({
    where: { OR: [{ slug: communityIdOrSlug }, { id: communityIdOrSlug }] },
    select: { id: true },
  });
  if (!community) {
    throw new Error('Community not found');
  }

  const perm = await getMemberPermission(moderatorId, community.id);
  if (!perm.canManageMembers) {
    throw new Error('Unauthorized: Admin privileges required to view join requests');
  }

  const requests = await prisma.communityJoinRequest.findMany({
    where: { communityId: community.id, status },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    communityId: community.id,
    requests: requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.user.username,
      avatarUrl: r.user.avatarUrl,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/**
 * @deprecated Legacy plaintext-token invite with no redemption path. Use
 * src/lib/community/invitations.ts (hashed access keys) instead.
 */
export async function createCommunityInvite(
  inviterId: string,
  communityId: string,
  maxUses?: number,
  expiresInHours = 48
) {
  const perm = await getMemberPermission(inviterId, communityId);
  if (!perm.isMember) {
    throw new Error('Must be an active member to create an invite');
  }

  const token = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInHours * 3600000);

  const invite = await prisma.communityInvite.create({
    data: {
      communityId,
      createdBy: inviterId,
      token,
      maxUses: maxUses || null,
      expiresAt,
    },
  });

  await emitEngineEvent({
    eventType: 'MEMBER_INVITED',
    userId: inviterId,
    entityType: 'COMMUNITY',
    entityId: communityId,
    // Never put the token itself in the event log.
    metadata: { inviteId: invite.id },
  });

  return invite;
}

export async function updateMemberRole(
  moderatorId: string,
  communityId: string,
  targetUserId: string,
  newRole: 'ADMIN' | 'MODERATOR' | 'MEMBER'
) {
  const perm = await getMemberPermission(moderatorId, communityId);
  if (!perm.isOwner && !perm.isAdmin) {
    throw new Error('Unauthorized: Admin privileges required to change roles');
  }

  const targetPerm = await getMemberPermission(targetUserId, communityId);
  if (targetPerm.isOwner) {
    throw new Error('Cannot modify role of community owner');
  }

  const updated = await prisma.communityMember.update({
    where: { communityId_userId: { communityId, userId: targetUserId } },
    data: { role: newRole },
  });

  await prisma.moderationAction.create({
    data: {
      moderatorId,
      targetUserId,
      communityId,
      targetType: 'COMMUNITY_MEMBER',
      targetId: targetUserId,
      action: 'ROLE_CHANGE',
      reason: `Role changed to ${newRole}`,
    },
  });

  await emitEngineEvent({
    eventType: 'ROLE_CHANGED',
    userId: moderatorId,
    entityType: 'COMMUNITY',
    entityId: communityId,
    metadata: { targetUserId, newRole },
  });

  return updated;
}

export async function muteCommunityMember(
  moderatorId: string,
  communityId: string,
  targetUserId: string,
  durationMinutes: number,
  reason: string
) {
  const perm = await getMemberPermission(moderatorId, communityId);
  if (!perm.canModerate) {
    throw new Error('Unauthorized: Moderator privileges required to mute');
  }

  const targetPerm = await getMemberPermission(targetUserId, communityId);
  if (targetPerm.isOwner) {
    throw new Error('Cannot mute community owner');
  }

  const mutedUntil = new Date(Date.now() + durationMinutes * 60000);

  await prisma.$transaction(async (tx) => {
    await tx.communityMember.update({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      data: { mutedUntil },
    });

    await tx.moderationAction.create({
      data: {
        moderatorId,
        targetUserId,
        communityId,
        targetType: 'COMMUNITY_MEMBER',
        targetId: targetUserId,
        action: 'TIMEOUT',
        reason: `${reason} (${durationMinutes} mins)`,
      },
    });
  });

  await emitEngineEvent({
    eventType: 'MEMBER_MUTED',
    userId: moderatorId,
    entityType: 'COMMUNITY',
    entityId: communityId,
    metadata: { targetUserId, durationMinutes, reason },
  });

  return { success: true, targetUserId, mutedUntil };
}

export async function unmuteCommunityMember(
  moderatorId: string,
  communityId: string,
  targetUserId: string
) {
  const perm = await getMemberPermission(moderatorId, communityId);
  if (!perm.canModerate) {
    throw new Error('Unauthorized: Moderator privileges required');
  }

  await prisma.communityMember.update({
    where: { communityId_userId: { communityId, userId: targetUserId } },
    data: { mutedUntil: null },
  });

  await emitEngineEvent({
    eventType: 'MEMBER_UNMUTED',
    userId: moderatorId,
    entityType: 'COMMUNITY',
    entityId: communityId,
    metadata: { targetUserId },
  });

  return { success: true, targetUserId, mutedUntil: null };
}

export async function banCommunityMember(
  moderatorId: string,
  communityId: string,
  targetUserId: string,
  reason: string,
  durationHours?: number
) {
  const perm = await getMemberPermission(moderatorId, communityId);
  if (!perm.canModerate) {
    throw new Error('Unauthorized: Moderator privileges required');
  }

  const targetPerm = await getMemberPermission(targetUserId, communityId);
  if (targetPerm.isOwner) {
    throw new Error('Cannot ban community owner');
  }

  const expiresAt = durationHours ? new Date(Date.now() + durationHours * 3600000) : null;

  await prisma.$transaction(async (tx) => {
    await tx.communityBan.upsert({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      update: { reason, createdBy: moderatorId, expiresAt, createdAt: new Date() },
      create: { communityId, userId: targetUserId, reason, createdBy: moderatorId, expiresAt },
    });

    await tx.communityMember.updateMany({
      where: { communityId, userId: targetUserId },
      data: { status: 'BANNED' },
    });

    await tx.moderationAction.create({
      data: {
        moderatorId,
        targetUserId,
        communityId,
        targetType: 'COMMUNITY_MEMBER',
        targetId: targetUserId,
        action: 'BAN',
        reason,
      },
    });

    const total = await tx.communityMember.count({
      where: { communityId, status: 'ACTIVE' },
    });
    await tx.community.update({
      where: { id: communityId },
      data: { memberCount: total },
    });
  });

  await refreshCommunityAggregatesSafe(communityId);

  await emitEngineEvent({
    eventType: 'MEMBER_BANNED',
    userId: moderatorId,
    entityType: 'COMMUNITY',
    entityId: communityId,
    metadata: { targetUserId, reason },
  });

  return { success: true, targetUserId, status: 'BANNED' };
}

export async function unbanCommunityMember(
  moderatorId: string,
  communityId: string,
  targetUserId: string
) {
  const perm = await getMemberPermission(moderatorId, communityId);
  if (!perm.canModerate) {
    throw new Error('Unauthorized: Moderator privileges required');
  }

  await prisma.$transaction(async (tx) => {
    await tx.communityBan.deleteMany({
      where: { communityId, userId: targetUserId },
    });

    await tx.communityMember.updateMany({
      where: { communityId, userId: targetUserId },
      data: { status: 'ACTIVE' },
    });

    await tx.moderationAction.create({
      data: {
        moderatorId,
        targetUserId,
        communityId,
        targetType: 'COMMUNITY_MEMBER',
        targetId: targetUserId,
        action: 'UNBAN',
        reason: 'Unbanned by moderator',
      },
    });
  });

  await refreshCommunityAggregatesSafe(communityId);

  await emitEngineEvent({
    eventType: 'MEMBER_UNBANNED',
    userId: moderatorId,
    entityType: 'COMMUNITY',
    entityId: communityId,
    metadata: { targetUserId },
  });

  return { success: true, targetUserId, status: 'ACTIVE' };
}

export async function transferCommunityOwnership(
  currentOwnerId: string,
  communityId: string,
  newOwnerId: string
) {
  const perm = await getMemberPermission(currentOwnerId, communityId);
  if (!perm.isOwner) {
    throw new Error('Unauthorized: Only current owner can transfer community ownership');
  }

  await prisma.$transaction(async (tx) => {
    await tx.community.update({
      where: { id: communityId },
      data: { ownerId: newOwnerId },
    });

    // Update old owner to ADMIN
    await tx.communityMember.updateMany({
      where: { communityId, userId: currentOwnerId },
      data: { role: 'ADMIN' },
    });

    // Update new owner to OWNER
    await tx.communityMember.upsert({
      where: { communityId_userId: { communityId, userId: newOwnerId } },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: { communityId, userId: newOwnerId, role: 'OWNER', status: 'ACTIVE' },
    });

    await tx.moderationAction.create({
      data: {
        moderatorId: currentOwnerId,
        targetUserId: newOwnerId,
        communityId,
        targetType: 'COMMUNITY',
        targetId: communityId,
        action: 'OWNERSHIP_TRANSFERRED',
        reason: 'Ownership transferred to new user',
      },
    });
  });

  return { success: true, newOwnerId };
}

/**
 * =========================================================================
 * 4. POSTS, COMMENTS, DISCUSSIONS, POLLS & SPOILERS
 * =========================================================================
 */

export async function createCommunityPost(input: CreatePostInput) {
  const {
    authorId,
    communityId,
    channelId,
    title,
    body,
    type = 'GENERAL',
    spoilerLevel = 'NO_SPOILER',
    animeId,
    episodeId,
    poll,
  } = input;

  const perm = await getMemberPermission(authorId, communityId);
  if (!perm.canPost) {
    throw new Error('Unauthorized: You must be an active, unmuted member to post');
  }

  if (!title || title.trim().length === 0) {
    throw new Error('Post title is required');
  }
  if (!body || body.trim().length === 0) {
    throw new Error('Post content is required');
  }

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.discussion.create({
      data: {
        authorId,
        communityId,
        channelId: channelId || null,
        title: title.trim(),
        body: body.trim(),
        type,
        spoilerLevel,
        animeId: animeId || null,
        episodeId: episodeId || null,
        status: 'ACTIVE',
        poll: poll && Array.isArray(poll.options) && poll.options.length >= 2 ? {
          create: {
            question: poll.question.trim(),
            expiresAt: poll.expiresInDays ? new Date(Date.now() + poll.expiresInDays * 86400000) : null,
            options: {
              create: poll.options.filter((o) => o.trim()).map((text, idx) => ({
                text: text.trim(),
                position: idx,
              })),
            },
          },
        } : undefined,
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        poll: { include: { options: { include: { votes: true } } } },
      },
    });

    return created;
  });

  // Extract @mentions and trigger notifications
  await extractMentionsAndNotify(body, authorId, `/community/${communityId}/discussion/${post.id}`, title);

  // A new post is "new activity" for every other active member of the
  // community — mentions above already covers anyone @mentioned in the
  // body specifically.
  await notifyCommunityMembersOfNewDiscussion(communityId, post.id, title, authorId);

  // Followers: "active in the community" (public communities only, once a day).
  await notifyFollowersOfDiscussion(authorId, post.id);

  await emitEngineEvent({
    eventType: 'POST_CREATED',
    userId: authorId,
    entityType: 'DISCUSSION',
    entityId: post.id,
    metadata: { communityId, title: post.title, spoilerLevel },
  });

  return post;
}

// Comment creation lives in commentService (one implementation for the API
// routes and the engine); re-exported here for existing importers.
export { createDiscussionComment } from './commentService';

export async function voteInPoll(userId: string, optionId: string) {
  const option = await prisma.pollOption.findUnique({
    where: { id: optionId },
    include: { poll: true },
  });

  if (!option) {
    throw new Error('Poll option not found');
  }

  if (option.poll.expiresAt && option.poll.expiresAt < new Date()) {
    throw new Error('This poll has expired');
  }

  // Prevent duplicate voting in same poll
  const existingVote = await prisma.pollVote.findFirst({
    where: {
      userId,
      option: { pollId: option.pollId },
    },
  });

  if (existingVote) {
    throw new Error('You have already voted in this poll');
  }

  const vote = await prisma.pollVote.create({
    data: {
      userId,
      optionId,
    },
  });

  return vote;
}

export async function reactToPost(userId: string, discussionId: string, type: string = 'HELPFUL') {
  const reaction = await prisma.discussionReaction.upsert({
    where: {
      discussionId_userId_type: {
        discussionId,
        userId,
        type,
      },
    },
    update: {},
    create: {
      discussionId,
      userId,
      type,
    },
  });

  const totalHelpful = await prisma.discussionReaction.count({
    where: { discussionId, type: 'HELPFUL' },
  });

  await prisma.discussion.update({
    where: { id: discussionId },
    data: { helpfulCount: totalHelpful },
  });

  return reaction;
}

export async function reactToComment(userId: string, commentId: string, type: string = 'LIKE') {
  const reaction = await prisma.commentReaction.upsert({
    where: {
      commentId_userId_type: {
        commentId,
        userId,
        type,
      },
    },
    update: {},
    create: {
      commentId,
      userId,
      type,
    },
  });

  return reaction;
}

export async function extractMentionsAndNotify(
  content: string,
  authorId: string,
  linkUrl: string,
  contextTitle: string
) {
  const mentionMatches = content.match(/@([a-zA-Z0-9_-]+)/g);
  if (!mentionMatches) return;

  const usernames = Array.from(new Set(mentionMatches.map((m) => m.slice(1))));
  const users = await prisma.user.findMany({
    where: { username: { in: usernames }, id: { not: authorId } },
    select: { id: true, username: true },
  });

  for (const user of users) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'MENTION',
        title: 'You were mentioned',
        body: `You were mentioned in "${contextTitle.slice(0, 40)}"`,
        linkUrl,
      },
    });
  }
}

/**
 * Notifies every other active member of a community when a new
 * discussion post is created in it — "new activity" for the community.
 * Best-effort (mirrors notifyCommunityManagers above): a notification
 * failure must never fail or roll back the post itself.
 *
 * No per-user mute/opt-out exists yet (no NotificationPreference model
 * in the schema as of this writing) and no member-count cap is applied
 * here — every active member of even a very large community gets
 * notified on every post. That's consistent with how every other
 * notification in this codebase behaves today (unconditional), but is
 * worth flagging: a preference/mute gate is the natural next step if
 * this turns out to be too noisy for large communities in practice.
 */
export async function notifyCommunityMembersOfNewDiscussion(
  communityId: string,
  discussionId: string,
  discussionTitle: string,
  authorId: string
): Promise<void> {
  try {
    const [community, author, members] = await Promise.all([
      prisma.community.findUnique({ where: { id: communityId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: authorId }, select: { username: true } }),
      prisma.communityMember.findMany({
        where: { communityId, status: 'ACTIVE', userId: { not: authorId } },
        select: { userId: true },
      }),
    ]);

    if (members.length === 0 || !community) return;

    const who = author?.username ? `@${author.username}` : 'Someone';
    const linkUrl = `/community/${communityId}/discussion/${discussionId}`;

    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        type: 'COMMUNITY_NEW_DISCUSSION',
        title: `New post in ${community.name}`,
        body: `${who} posted "${discussionTitle.slice(0, 60)}"`,
        linkUrl,
      })),
    });
  } catch (err) {
    console.error('[community] Failed to notify members of new discussion', {
      communityId,
      discussionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * =========================================================================
 * 5. MODERATION & REPORTS
 * =========================================================================
 */

export async function reportCommunityContent(
  reporterId: string,
  targetType: 'USER' | 'COMMUNITY' | 'DISCUSSION' | 'COMMENT' | 'MESSAGE',
  targetId: string,
  reason: ReportReason,
  description?: string
) {
  const report = await prisma.report.create({
    data: {
      reporterId,
      targetType,
      targetId,
      reason,
      description: description?.trim() || null,
      status: 'OPEN',
    },
  });

  await emitEngineEvent({
    eventType: 'REPORT_CREATED',
    userId: reporterId,
    entityType: 'COMMUNITY',
    entityId: targetId,
    metadata: { reportId: report.id, reason, targetType },
  });

  return report;
}

export async function lockDiscussion(moderatorId: string, discussionId: string, reason: string) {
  const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!discussion || !discussion.communityId) {
    throw new Error('Discussion not found');
  }

  const perm = await getMemberPermission(moderatorId, discussion.communityId);
  if (!perm.canModerate) {
    throw new Error('Unauthorized: Moderator privileges required');
  }

  const updated = await prisma.discussion.update({
    where: { id: discussionId },
    data: { status: 'LOCKED' },
  });

  await prisma.moderationAction.create({
    data: {
      moderatorId,
      communityId: discussion.communityId,
      targetType: 'DISCUSSION',
      targetId: discussionId,
      action: 'LOCK',
      reason,
    },
  });

  await emitEngineEvent({
    eventType: 'MODERATION_ACTION',
    userId: moderatorId,
    entityType: 'DISCUSSION',
    entityId: discussionId,
    metadata: { action: 'LOCK', reason },
  });

  return updated;
}

export async function removeModeratedContent(
  moderatorId: string,
  targetType: 'DISCUSSION' | 'COMMENT' | 'MESSAGE',
  targetId: string,
  reason: string
) {
  if (targetType === 'DISCUSSION') {
    const post = await prisma.discussion.findUnique({ where: { id: targetId } });
    if (!post || !post.communityId) throw new Error('Post not found');

    const perm = await getMemberPermission(moderatorId, post.communityId);
    if (!perm.canModerate) throw new Error('Unauthorized');

    await prisma.discussion.update({
      where: { id: targetId },
      data: { status: 'HIDDEN' },
    });
  } else if (targetType === 'COMMENT') {
    const comment = await prisma.discussionComment.findUnique({
      where: { id: targetId },
      include: { discussion: true },
    });
    if (!comment || !comment.discussion.communityId) throw new Error('Comment not found');

    const perm = await getMemberPermission(moderatorId, comment.discussion.communityId);
    if (!perm.canModerate) throw new Error('Unauthorized');

    await prisma.discussionComment.update({
      where: { id: targetId },
      data: { deletedAt: new Date() },
    });
  } else if (targetType === 'MESSAGE') {
    const msg = await prisma.communityMessage.findUnique({
      where: { id: targetId },
      include: { channel: true },
    });
    if (!msg) throw new Error('Message not found');

    const perm = await getMemberPermission(moderatorId, msg.channel.communityId);
    if (!perm.canModerate) throw new Error('Unauthorized');

    await prisma.communityMessage.update({
      where: { id: targetId },
      data: { deletedAt: new Date() },
    });
  }

  await prisma.moderationAction.create({
    data: {
      moderatorId,
      targetType,
      targetId,
      action: 'DELETE',
      reason,
    },
  });
}

/**
 * =========================================================================
 * 6. REAL-TIME CHAT, TYPING & PRESENCE STATE
 * =========================================================================
 */

export async function sendCommunityChatMessage(
  userId: string,
  channelId: string,
  body: string,
  replyToId?: string,
  spoilerLevel: SpoilerLevel = 'NO_SPOILER'
) {
  const channel = await prisma.communityChannel.findUnique({
    where: { id: channelId },
    include: { community: true },
  });

  if (!channel) {
    throw new Error('Channel not found');
  }

  const perm = await getMemberPermission(userId, channel.communityId);
  if (!perm.canChat) {
    throw new Error('Unauthorized: Active community membership required to chat');
  }

  if (!body || body.trim().length === 0) {
    throw new Error('Message body cannot be empty');
  }

  if (body.length > 2000) {
    throw new Error('Message exceeds 2000 characters limit');
  }

  const created = await prisma.communityMessage.create({
    data: {
      channelId,
      authorId: userId,
      body: body.trim(),
      replyToId: replyToId || null,
      spoilerLevel,
    },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  // Role + reviewer badge ride along so every client can show who is talking.
  const authorMeta = (
    await getChatAuthorMeta(channel.communityId, channel.community.ownerId, [userId])
  ).get(userId);
  const message = { ...created, author: { ...created.author, ...authorMeta } };

  await emitEngineEvent({
    eventType: 'MESSAGE_CREATED',
    userId,
    entityType: 'MESSAGE',
    entityId: message.id,
    metadata: { channelId, communityId: channel.communityId },
  });

  // Real-time broadcast to socket channel subscribers if socket server is initialized
  try {
    const io = (global as any).socketio;
    if (io) {
      io.to(`channel:${channelId}`).emit('new_message', {
        id: message.id,
        channelId: message.channelId,
        body: message.body,
        spoilerLevel: message.spoilerLevel,
        replyToId: message.replyToId,
        createdAt: message.createdAt.toISOString(),
        author: message.author,
      });
    }
  } catch (socketErr) {
    // Non-blocking socket broadcast error
    console.error('[Socket] Failed to broadcast new message:', socketErr);
  }

  return {
    message,
    room: `community:${channel.communityId}`,
    channelRoom: `channel:${channelId}`,
  };
}

export async function editCommunityChatMessage(userId: string, messageId: string, newBody: string) {
  const msg = await prisma.communityMessage.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Message not found');
  if (msg.authorId !== userId) throw new Error('Unauthorized to edit message');

  const updated = await prisma.communityMessage.update({
    where: { id: messageId },
    data: { body: newBody.trim(), updatedAt: new Date() },
    include: { author: { select: { id: true, username: true, avatarUrl: true } } },
  });

  return updated;
}

export async function deleteCommunityChatMessage(userId: string, messageId: string) {
  const msg = await prisma.communityMessage.findUnique({
    where: { id: messageId },
    include: { channel: true },
  });
  if (!msg) throw new Error('Message not found');

  const perm = await getMemberPermission(userId, msg.channel.communityId);
  if (msg.authorId !== userId && !perm.canModerate) {
    throw new Error('Unauthorized to delete message');
  }

  const deleted = await prisma.communityMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  await emitEngineEvent({
    eventType: 'MESSAGE_DELETED',
    userId,
    entityType: 'MESSAGE',
    entityId: messageId,
  });

  return deleted;
}

// Presence Tracker
export function trackUserPresence(communityId: string, userId: string, status: 'ONLINE' | 'AWAY' | 'OFFLINE') {
  if (!communityPresenceMap.has(communityId)) {
    communityPresenceMap.set(communityId, new Map());
  }

  const usersMap = communityPresenceMap.get(communityId)!;
  if (status === 'OFFLINE') {
    usersMap.delete(userId);
  } else {
    usersMap.set(userId, { userId, status, lastSeen: Date.now() });
  }
}

export function getCommunityOnlineCount(communityId: string): number {
  const usersMap = communityPresenceMap.get(communityId);
  if (!usersMap) return 1;
  // Expire stale presences older than 5 minutes
  const now = Date.now();
  let count = 0;
  for (const [uid, presence] of usersMap.entries()) {
    if (now - presence.lastSeen < 300000) {
      count++;
    } else {
      usersMap.delete(uid);
    }
  }
  return Math.max(1, count);
}

// Typing Indicator Tracker
export function setTypingState(communityId: string, userId: string, username: string, isTyping: boolean) {
  if (!communityTypingMap.has(communityId)) {
    communityTypingMap.set(communityId, new Map());
  }

  const typingMap = communityTypingMap.get(communityId)!;
  if (isTyping) {
    typingMap.set(userId, { username, timestamp: Date.now() });
  } else {
    typingMap.delete(userId);
  }
}

export function getActiveTypingUsers(communityId: string): string[] {
  const typingMap = communityTypingMap.get(communityId);
  if (!typingMap) return [];
  const now = Date.now();
  const active: string[] = [];
  for (const [uid, entry] of typingMap.entries()) {
    if (now - entry.timestamp < 5000) {
      active.push(entry.username);
    } else {
      typingMap.delete(uid);
    }
  }
  return active;
}

/**
 * =========================================================================
 * 7. ANIME CONTEXT & INTEGRATION
 * =========================================================================
 */

export async function getAnimeCommunityDiscussions(animeId: string, limit = 10) {
  return prisma.discussion.findMany({
    where: {
      animeId,
      status: { notIn: ['HIDDEN'] },
    },
    take: limit,
    orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
      community: { select: { id: true, name: true, slug: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });
}
