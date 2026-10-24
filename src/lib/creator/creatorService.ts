/**
 * Creator Mode (2026-10-24): the creator role, creator reviews, and the
 * dashboard's numbers. Everything here derives identity and role from the
 * authenticated user id the route passes in — never from request fields.
 *
 * Becoming a creator: a signed-in USER calls upgradeToCreator with a channel
 * name (and optional channel URL). That's the explicit step; nothing on the
 * client can set the role. Staff roles (moderator, editors, admins) aren't
 * switched here — an admin manages those via /api/admin/users/:id/role.
 *
 * Creator reviews are ordinary Review rows (one per member per anime):
 *   - draft  → status DRAFT, never shown publicly
 *   - publish → goes through createAndAnalyzeReview (aspects, badge counting,
 *     aggregates, follower notifications) and is then stamped
 *     isCreatorReview = true by the server
 * A score, when given, is the creator's real AnimeRating (submitUserRating),
 * applied on publish — the same rule as everyone (no rating before ep 1).
 */
import { prisma } from '../prisma';
import { isCreator } from '../roles';
import { createAndAnalyzeReview, deleteReview } from '../engine/review/reviewIntelligence';
import { submitUserRating, validateRatingScore } from '../rating/ratingService';
import { getEpisodeReleaseState } from '../rating/episodeRatings';
import { getAnimeDisplayTitle } from '../animeTitleResolver';

export class CreatorError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// ── Role ────────────────────────────────────────────────────────────────────

const CHANNEL_NAME_MAX = 60;
const CHANNEL_URL_MAX = 200;

export interface CreatorProfile {
  isCreator: boolean;
  role: string;
  creatorSince: string | null;
  channelName: string | null;
  channelUrl: string | null;
}

export async function getCreatorProfile(userId: string): Promise<CreatorProfile> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, creatorSince: true, creatorChannelName: true, creatorChannelUrl: true },
  });
  if (!u) throw new CreatorError(401, 'UNAUTHENTICATED', 'Authentication required.');
  return {
    isCreator: isCreator(u.role),
    role: u.role,
    creatorSince: u.creatorSince ? u.creatorSince.toISOString() : null,
    channelName: u.creatorChannelName,
    channelUrl: u.creatorChannelUrl,
  };
}

function cleanChannel(input: { channelName?: unknown; channelUrl?: unknown }) {
  // eslint-disable-next-line no-control-regex
  const name = typeof input.channelName === 'string' ? input.channelName.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim() : '';
  if (name.length < 2 || name.length > CHANNEL_NAME_MAX) {
    throw new CreatorError(400, 'INVALID_CHANNEL_NAME', `Channel name must be 2–${CHANNEL_NAME_MAX} characters.`);
  }
  let url: string | null = null;
  if (typeof input.channelUrl === 'string' && input.channelUrl.trim()) {
    const raw = input.channelUrl.trim();
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new CreatorError(400, 'INVALID_CHANNEL_URL', 'Channel link must be a full https:// address.');
    }
    if (parsed.protocol !== 'https:' || raw.length > CHANNEL_URL_MAX) {
      throw new CreatorError(400, 'INVALID_CHANNEL_URL', 'Channel link must be a full https:// address.');
    }
    url = parsed.toString();
  }
  return { name, url };
}

/** The explicit USER → CREATOR step. Idempotent for someone already a creator (updates the channel). */
export async function upgradeToCreator(userId: string, input: { channelName?: unknown; channelUrl?: unknown }): Promise<CreatorProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, creatorSince: true } });
  if (!user) throw new CreatorError(401, 'UNAUTHENTICATED', 'Authentication required.');
  const { name, url } = cleanChannel(input);
  if (user.role !== 'USER' && user.role !== 'CREATOR') {
    throw new CreatorError(409, 'STAFF_ROLE', 'Staff accounts already have creator tools; their role is managed by an admin.');
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      role: 'CREATOR',
      creatorSince: user.creatorSince ?? new Date(),
      creatorChannelName: name,
      creatorChannelUrl: url,
    },
  });
  return getCreatorProfile(userId);
}

export async function requireCreator(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!u || !isCreator(u.role)) throw new CreatorError(403, 'NOT_CREATOR', 'This needs a creator account.');
}

// ── Creator reviews ─────────────────────────────────────────────────────────

const SPOILER_LEVELS = ['SPOILER_FREE', 'MILD_SPOILERS', 'SPOILERS', 'FULL_SPOILERS'] as const;
type SpoilerLevel = (typeof SPOILER_LEVELS)[number];

export interface CreatorReviewInput {
  animeId?: unknown;
  title?: unknown;
  body?: unknown;
  score?: unknown;
  spoilerLevel?: unknown;
  publish?: unknown;
}

export interface CreatorReviewDto {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  isCreatorReview: boolean;
  title: string;
  body: string;
  score: number | null;
  spoilerLevel: SpoilerLevel;
  anime: { id: string; slug: string; title: string; posterUrl: string | null };
  createdAt: string;
  updatedAt: string;
}

function toDto(r: any, score: number | null): CreatorReviewDto {
  return {
    id: r.id,
    status: r.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    isCreatorReview: r.isCreatorReview,
    title: r.title,
    body: r.body,
    score,
    spoilerLevel: (SPOILER_LEVELS as readonly string[]).includes(r.spoilerLevel) ? r.spoilerLevel : 'SPOILER_FREE',
    anime: { id: r.anime.id, slug: r.anime.slug, title: getAnimeDisplayTitle(r.anime), posterUrl: r.anime.posterUrl || null },
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const ANIME_SELECT = { id: true, slug: true, canonicalTitle: true, posterUrl: true, titles: true } as const;

function cleanReview(input: CreatorReviewInput) {
  const title = typeof input.title === 'string' ? input.title.replace(/\s+/g, ' ').trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (title.length < 3 || title.length > 120) throw new CreatorError(400, 'INVALID_TITLE', 'Title must be 3–120 characters.');
  if (body.length < 20) throw new CreatorError(400, 'INVALID_BODY', 'The review must be at least 20 characters.');
  if (body.length > 5000) throw new CreatorError(400, 'INVALID_BODY', 'The review can be at most 5,000 characters.');
  const spoilerLevel: SpoilerLevel =
    typeof input.spoilerLevel === 'string' && (SPOILER_LEVELS as readonly string[]).includes(input.spoilerLevel)
      ? (input.spoilerLevel as SpoilerLevel)
      : 'SPOILER_FREE';
  let score: number | null = null;
  if (input.score !== undefined && input.score !== null && input.score !== '') {
    const v = validateRatingScore(Number(input.score));
    if (!v.valid) throw new CreatorError(400, 'INVALID_SCORE', v.error || 'Invalid score.');
    score = v.normalized;
  }
  return { title, body, spoilerLevel, score };
}

async function resolveAnime(animeId: unknown) {
  if (typeof animeId !== 'string' || !animeId.trim()) throw new CreatorError(400, 'ANIME_REQUIRED', 'Choose an anime.');
  const anime = await prisma.anime.findFirst({ where: { OR: [{ id: animeId }, { slug: animeId }] }, select: { id: true } });
  if (!anime) throw new CreatorError(404, 'ANIME_NOT_FOUND', 'Anime not found.');
  return anime.id;
}

async function liveScore(userId: string, animeId: string): Promise<number | null> {
  const r = await prisma.animeRating.findUnique({ where: { userId_animeId: { userId, animeId } }, select: { rating: true, deletedAt: true } });
  return r && !r.deletedAt ? r.rating : null;
}

/**
 * Create or update the creator's review of one anime, as a draft or published.
 * Drafts are only for reviews that aren't live yet — a published review is
 * edited and re-published, never pulled back to draft by accident.
 */
export async function saveCreatorReview(userId: string, input: CreatorReviewInput): Promise<CreatorReviewDto> {
  await requireCreator(userId);
  const animeId = await resolveAnime(input.animeId);
  const { title, body, spoilerLevel, score } = cleanReview(input);
  const publish = input.publish === true;

  const existing = await prisma.review.findUnique({ where: { userId_animeId: { userId, animeId } } });
  const wasLive = Boolean(existing && existing.status === 'PUBLISHED' && !existing.deletedAt);

  if (!publish) {
    if (wasLive) {
      throw new CreatorError(409, 'ALREADY_PUBLISHED', 'This review is already published. Save your changes with Publish.');
    }
    const data = {
      title,
      body,
      spoilerLevel,
      containsSpoiler: spoilerLevel !== 'SPOILER_FREE',
      status: 'DRAFT',
      deletedAt: null,
      // A draft's score waits here until publish; it isn't a rating yet.
      rating: score,
    };
    const row = existing
      ? await prisma.review.update({ where: { id: existing.id }, data, include: { anime: { select: ANIME_SELECT } } })
      : await prisma.review.create({ data: { userId, animeId, ...data }, include: { anime: { select: ANIME_SELECT } } });
    return toDto(row, score);
  }

  // Publishing follows the same rule as every review: not before episode 1.
  const release = await getEpisodeReleaseState(animeId);
  if (!release.isOpen) throw new CreatorError(403, 'NOT_AIRED', 'Reviews open when episode 1 airs. Save it as a draft for now.');

  if (score !== null) await submitUserRating({ userId, animeId, score });
  const userAnime = await prisma.userAnime.findUnique({ where: { userId_animeId: { userId, animeId } }, select: { status: true, episodesWatched: true } });
  const { review } = await createAndAnalyzeReview({
    userId,
    animeId,
    title,
    body,
    rating: score ?? (await liveScore(userId, animeId)),
    spoilerLevel,
    containsSpoiler: spoilerLevel !== 'SPOILER_FREE',
    watchStatusAtReview: userAnime?.status || null,
    episodeProgressAtReview: userAnime?.episodesWatched ?? null,
  });
  // The Creator Review label is set here, from the author's real role — the
  // client has no way to ask for it.
  const row = await prisma.review.update({
    where: { id: review.id },
    data: { isCreatorReview: true, edited: wasLive },
    include: { anime: { select: ANIME_SELECT } },
  });
  return toDto(row, await liveScore(userId, animeId));
}

/** Edit by review id (must be the author's own). */
export async function updateCreatorReview(userId: string, reviewId: string, input: CreatorReviewInput) {
  const own = await prisma.review.findFirst({ where: { id: reviewId, userId, deletedAt: null }, select: { animeId: true } });
  if (!own) throw new CreatorError(404, 'REVIEW_NOT_FOUND', 'Review not found.');
  return saveCreatorReview(userId, { ...input, animeId: own.animeId });
}

export async function deleteCreatorReview(userId: string, reviewId: string) {
  const own = await prisma.review.findFirst({ where: { id: reviewId, userId, deletedAt: null }, select: { id: true, status: true } });
  if (!own) throw new CreatorError(404, 'REVIEW_NOT_FOUND', 'Review not found.');
  if (own.status === 'DRAFT') {
    await prisma.review.delete({ where: { id: own.id } });
  } else {
    await deleteReview(userId, own.id);
  }
  return { deleted: true };
}

export async function getCreatorReview(userId: string, reviewId: string): Promise<CreatorReviewDto> {
  const r = await prisma.review.findFirst({ where: { id: reviewId, userId, deletedAt: null }, include: { anime: { select: ANIME_SELECT } } });
  if (!r) throw new CreatorError(404, 'REVIEW_NOT_FOUND', 'Review not found.');
  return toDto(r, r.status === 'DRAFT' ? r.rating : await liveScore(userId, r.animeId));
}

/** The creator's drafts and published creator reviews, newest first. */
export async function listCreatorReviews(userId: string): Promise<CreatorReviewDto[]> {
  const rows = await prisma.review.findMany({
    where: { userId, deletedAt: null, OR: [{ status: 'DRAFT' }, { status: 'PUBLISHED', isCreatorReview: true }] },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: { anime: { select: ANIME_SELECT } },
  });
  const ratings = await prisma.animeRating.findMany({
    where: { userId, deletedAt: null, animeId: { in: rows.map((r) => r.animeId) } },
    select: { animeId: true, rating: true },
  });
  const byAnime = new Map(ratings.map((r) => [r.animeId, r.rating]));
  return rows.map((r) => toDto(r, r.status === 'DRAFT' ? r.rating : byAnime.get(r.animeId) ?? null));
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export async function getCreatorDashboard(userId: string) {
  await requireCreator(userId);
  const communities = await prisma.community.findMany({
    where: { ownerId: userId, status: { not: 'DELETED' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      iconUrl: true,
      visibility: true,
      joinPolicy: true,
      memberCount: true,
      createdAt: true,
      _count: { select: { members: { where: { status: 'ACTIVE' } }, invites: { where: { revokedAt: null, keyHash: { not: null } } } } },
    },
  });
  const ids = communities.map((c) => c.id);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [followerTotal, followersThisWeek, recentFollowers, followingBack] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followingId: userId, createdAt: { gte: weekAgo } } }),
    prisma.follow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { createdAt: true, follower: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } } },
    }),
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
  ]);
  const iFollow = new Set(followingBack.map((f) => f.followingId));
  const [publishedReviews, draftReviews, recentJoins, recentPosts] = await Promise.all([
    prisma.review.count({ where: { userId, isCreatorReview: true, status: 'PUBLISHED', deletedAt: null } }),
    prisma.review.count({ where: { userId, status: 'DRAFT', deletedAt: null } }),
    ids.length
      ? prisma.communityMember.findMany({
          where: { communityId: { in: ids }, status: 'ACTIVE', userId: { not: userId } },
          orderBy: { joinedAt: 'desc' },
          take: 8,
          select: { joinedAt: true, user: { select: { username: true } }, community: { select: { name: true, slug: true } } },
        })
      : [],
    ids.length
      ? prisma.discussion.findMany({
          where: { communityId: { in: ids }, status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id: true, title: true, createdAt: true, author: { select: { username: true } }, community: { select: { name: true, slug: true } } },
        })
      : [],
  ]);

  const activity = [
    ...recentFollowers.slice(0, 5).map((f) => ({
      kind: 'FOLLOW' as const,
      at: f.createdAt.toISOString(),
      text: `@${f.follower.username} started following you`,
      href: `/profile/${f.follower.username}`,
    })),
    ...recentJoins.map((j) => ({
      kind: 'JOIN' as const,
      at: j.joinedAt.toISOString(),
      text: `@${j.user.username} joined ${j.community?.name}`,
      href: `/community/${j.community?.slug}`,
    })),
    ...recentPosts.map((p) => ({
      kind: 'POST' as const,
      at: p.createdAt.toISOString(),
      text: `@${p.author.username} posted “${p.title}” in ${p.community?.name}`,
      href: `/discussions/${p.id}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  return {
    profile: await getCreatorProfile(userId),
    followers: {
      total: followerTotal,
      thisWeek: followersThisWeek,
      recent: recentFollowers.map((f) => ({
        username: f.follower.username,
        displayName: f.follower.displayName,
        avatarUrl: f.follower.avatarUrl,
        followedAt: f.createdAt.toISOString(),
        youFollowBack: iFollow.has(f.follower.id),
        isCreator: f.follower.role === 'CREATOR',
      })),
    },
    stats: {
      followers: followerTotal,
      communities: communities.length,
      members: communities.reduce((n, c) => n + c._count.members, 0),
      publishedReviews,
      draftReviews,
    },
    communities: communities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      iconUrl: c.iconUrl,
      visibility: c.visibility,
      membersOnly: c.visibility === 'PRIVATE',
      memberCount: c._count.members,
      activeInvitations: c._count.invites,
      createdAt: c.createdAt.toISOString(),
    })),
    activity,
  };
}
