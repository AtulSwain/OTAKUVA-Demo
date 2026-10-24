/**
 * Following members, Instagram-style: follow someone and you're told when
 * they publish something. Only public things fan out — a private list, a
 * private community's thread or a removed article never notify anyone.
 *
 * Notification types written here (also listed on the Notification model):
 *   NEW_FOLLOWER           someone followed you
 *   FOLLOWING_REVIEW       someone you follow reviewed an anime
 *   FOLLOWING_ARTICLE      … published an article
 *   FOLLOWING_COLLECTION   … published a (public, non-empty) collection
 *   FOLLOWING_COMMUNITY    … is active in the community (at most one per
 *                          followed member per follower per day)
 *
 * Every fan-out is best-effort: a failure is logged and never fails or undoes
 * the action that triggered it.
 */
import { prisma } from '../prisma';
import { logger } from '../logger';
import { resolveAvatarUrl } from '../mediaResolver';

import { getAnimeDisplayTitle } from '../animeTitleResolver';

export type FollowNotificationType =
  | 'FOLLOWING_REVIEW'
  | 'FOLLOWING_ARTICLE'
  | 'FOLLOWING_COLLECTION'
  | 'FOLLOWING_COMMUNITY'
  // Creators only (2026-10-24): a creator rated an anime / is hyped for one.
  | 'FOLLOWING_RATING'
  | 'FOLLOWING_HYPE';

/** createMany batch size for one fan-out. */
const FANOUT_CHUNK = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
export const FOLLOW_LIST_PAGE = 30;

export class FollowError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}

const label = (u: { username: string; displayName?: string | null }) =>
  u.displayName && u.displayName !== u.username ? `${u.displayName} (@${u.username})` : `@${u.username}`;

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

async function findUserByUsername(username: string) {
  return prisma.user.findFirst({
    where: { username },
    select: { id: true, username: true, displayName: true, role: true, creatorChannelName: true, creatorChannelUrl: true },
  });
}

export async function followUser(followerId: string, targetUsername: string): Promise<{ created: boolean; followerCount: number }> {
  const [actor, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: followerId }, select: { id: true, username: true, displayName: true, role: true, creatorChannelName: true } }),
    findUserByUsername(targetUsername),
  ]);
  if (!actor) throw new FollowError(401, 'Authentication required.', 'UNAUTHENTICATED');
  if (!target) throw new FollowError(404, 'User not found.', 'USER_NOT_FOUND');
  if (target.id === followerId) throw new FollowError(400, 'You cannot follow yourself.', 'SELF_FOLLOW');

  let created = false;
  try {
    await prisma.follow.create({ data: { followerId, followingId: target.id } });
    created = true;
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e; // already following (incl. a double-tap race)
  }

  if (created) {
    // One "new follower" per pair per day, so follow/unfollow/follow can't spam.
    const recent = await prisma.notification.findFirst({
      where: {
        userId: target.id,
        type: 'NEW_FOLLOWER',
        linkUrl: `/profile/${actor.username}`,
        createdAt: { gt: new Date(Date.now() - DAY_MS) },
      },
      select: { id: true },
    });
    if (!recent) {
      await prisma.notification
        .create({
          data: {
            userId: target.id,
            type: 'NEW_FOLLOWER',
            // Say so when the new follower is a creator account (owner, 2026-10-24).
            title: actor.role === 'CREATOR' ? 'A creator followed you' : 'New follower',
            body:
              actor.role === 'CREATOR'
                ? `${label(actor)}, a creator${actor.creatorChannelName ? ` (${actor.creatorChannelName})` : ''}, started following you.`
                : `${label(actor)} started following you.`,
            linkUrl: `/profile/${actor.username}`,
          },
        })
        .catch((err) => logger.error('new-follower notification failed', { component: 'follow', err }));
    }
  }

  const followerCount = await prisma.follow.count({ where: { followingId: target.id } });
  return { created, followerCount };
}

export async function unfollowUser(followerId: string, targetUsername: string): Promise<{ followerCount: number }> {
  const target = await findUserByUsername(targetUsername);
  if (!target) throw new FollowError(404, 'User not found.', 'USER_NOT_FOUND');
  await prisma.follow.deleteMany({ where: { followerId, followingId: target.id } });
  return { followerCount: await prisma.follow.count({ where: { followingId: target.id } }) };
}

export interface FollowSummary {
  followerCount: number;
  followingCount: number;
  /** Whether the viewer follows this member (false when signed out / own profile). */
  isFollowing: boolean;
  /** Whether this member follows the viewer back. */
  followsYou: boolean;
  /** A creator account (Creator Mode) — profiles show it prominently. */
  isCreator: boolean;
  channelName: string | null;
  channelUrl: string | null;
}

export async function getFollowSummary(username: string, viewerId?: string | null): Promise<FollowSummary | null> {
  const user = await findUserByUsername(username);
  if (!user) return null;
  const isOther = Boolean(viewerId && viewerId !== user.id);
  const [followerCount, followingCount, mine, theirs] = await Promise.all([
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    isOther ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId!, followingId: user.id } } }) : null,
    isOther ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: viewerId! } } }) : null,
  ]);
  // Display: actual creator accounts only (isCreator() also passes admins, for permissions).
  const creator = user.role === 'CREATOR';
  return {
    followerCount,
    followingCount,
    isFollowing: Boolean(mine),
    followsYou: Boolean(theirs),
    isCreator: creator,
    channelName: creator ? user.creatorChannelName : null,
    channelUrl: creator ? user.creatorChannelUrl : null,
  };
}

export interface FollowListItem {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followedAt: string;
  /** Whether the viewer follows this person (null when signed out). */
  viewerFollows: boolean | null;
  isViewer: boolean;
  /** A creator account — lists label them. */
  isCreator: boolean;
  channelName: string | null;
}

/**
 * Followers of a member, or the members they follow, newest first.
 * Cursor = the ISO date of the last item's `followedAt`.
 */
export async function listFollows(
  username: string,
  which: 'followers' | 'following',
  opts: { viewerId?: string | null; before?: string | null; limit?: number } = {}
): Promise<{ items: FollowListItem[]; nextCursor: string | null } | null> {
  const user = await findUserByUsername(username);
  if (!user) return null;
  const limit = Math.min(Math.max(opts.limit ?? FOLLOW_LIST_PAGE, 1), 60);
  const before = opts.before ? new Date(opts.before) : null;

  const rows = await prisma.follow.findMany({
    where: {
      ...(which === 'followers' ? { followingId: user.id } : { followerId: user.id }),
      ...(before && !isNaN(+before) ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: {
      [which === 'followers' ? 'follower' : 'following']: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true, role: true, creatorChannelName: true },
      },
    },
  });

  const page = rows.slice(0, limit);
  const people = page.map((r: any) => ({ person: which === 'followers' ? r.follower : r.following, at: r.createdAt as Date }));

  let viewerFollowing = new Set<string>();
  if (opts.viewerId && people.length > 0) {
    const mine = await prisma.follow.findMany({
      where: { followerId: opts.viewerId, followingId: { in: people.map((p) => p.person.id) } },
      select: { followingId: true },
    });
    viewerFollowing = new Set(mine.map((m) => m.followingId));
  }

  return {
    items: people.map(({ person, at }) => ({
      username: person.username,
      displayName: person.displayName ?? null,
      avatarUrl: resolveAvatarUrl(person.avatarUrl),
      bio: person.bio ? clip(person.bio, 140) : null,
      followedAt: at.toISOString(),
      viewerFollows: opts.viewerId ? viewerFollowing.has(person.id) : null,
      isViewer: Boolean(opts.viewerId && opts.viewerId === person.id),
      isCreator: person.role === 'CREATOR',
      channelName: person.role === 'CREATOR' ? person.creatorChannelName ?? null : null,
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
  };
}

/**
 * Tell everyone who follows `actorId` about something they just published.
 * `linkUrl` doubles as the dedupe key: the same thing never fans out twice
 * (editing a review, re-saving a collection). Community activity is instead
 * throttled to one notification per followed member per follower per day
 * (keyed on the title, which names the member).
 */
export async function notifyFollowers(input: {
  actorId: string;
  type: FollowNotificationType;
  title: string;
  body: string;
  linkUrl: string;
}): Promise<number> {
  try {
    const followerIds = (
      await prisma.follow.findMany({ where: { followingId: input.actorId }, select: { followerId: true } })
    ).map((f) => f.followerId);
    if (followerIds.length === 0) return 0;

    let recipients = followerIds;
    if (input.type === 'FOLLOWING_COMMUNITY') {
      const recent = await prisma.notification.findMany({
        where: {
          userId: { in: followerIds },
          type: input.type,
          // The title names the followed member, so it's the throttle key.
          title: input.title,
          createdAt: { gt: new Date(Date.now() - DAY_MS) },
        },
        select: { userId: true },
      });
      const skip = new Set(recent.map((n) => n.userId));
      recipients = followerIds.filter((id) => !skip.has(id));
    } else {
      const already = await prisma.notification.findFirst({
        where: { type: input.type, linkUrl: input.linkUrl, userId: { in: followerIds } },
        select: { id: true },
      });
      if (already) return 0;
    }

    for (let i = 0; i < recipients.length; i += FANOUT_CHUNK) {
      await prisma.notification.createMany({
        data: recipients.slice(i, i + FANOUT_CHUNK).map((userId) => ({
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl,
        })),
      });
    }
    return recipients.length;
  } catch (err) {
    logger.error('follower fan-out failed', { component: 'follow', type: input.type, actorId: input.actorId, err });
    return 0;
  }
}

async function actorLabel(actorId: string): Promise<{ username: string; text: string } | null> {
  const u = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true, displayName: true } });
  return u ? { username: u.username, text: label(u) } : null;
}

/* ── Event helpers, called from the places that publish things ───────── */

export async function notifyFollowersOfReview(actorId: string, reviewId: string): Promise<void> {
  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { status: true, deletedAt: true, anime: { select: { id: true, slug: true, canonicalTitle: true } } },
    });
    if (!review || review.status !== 'PUBLISHED' || review.deletedAt || !review.anime) return;
    const actor = await actorLabel(actorId);
    if (!actor) return;
    await notifyFollowers({
      actorId,
      type: 'FOLLOWING_REVIEW',
      title: `${actor.text} reviewed ${clip(review.anime.canonicalTitle, 60)}`,
      body: `${actor.text}, who you follow, has reviewed ${review.anime.canonicalTitle}.`,
      linkUrl: `/anime/${review.anime.slug || review.anime.id}#review-${reviewId}`,
    });
  } catch (err) {
    logger.error('review fan-out failed', { component: 'follow', reviewId, err });
  }
}

export async function notifyFollowersOfArticle(actorId: string, article: { slug: string; title: string }): Promise<void> {
  const actor = await actorLabel(actorId).catch(() => null);
  if (!actor) return;
  await notifyFollowers({
    actorId,
    type: 'FOLLOWING_ARTICLE',
    title: `${actor.text} posted an article`,
    body: `${actor.text}, who you follow, has posted an article: “${clip(article.title)}”.`,
    linkUrl: `/articles/${article.slug}`,
  });
}

/** Only for a PUBLIC collection with at least one anime in it. */
export async function notifyFollowersOfCollection(actorId: string, listId: string): Promise<void> {
  try {
    const list = await prisma.userList.findUnique({
      where: { id: listId },
      select: { userId: true, name: true, visibility: true, shareToken: true, _count: { select: { items: true } } },
    });
    if (!list || list.userId !== actorId || list.visibility !== 'PUBLIC' || !list.shareToken || list._count.items === 0) return;
    const actor = await actorLabel(actorId);
    if (!actor) return;
    await notifyFollowers({
      actorId,
      type: 'FOLLOWING_COLLECTION',
      title: `${actor.text} published a collection`,
      body: `${actor.text}, who you follow, has published the collection “${clip(list.name)}”.`,
      linkUrl: `/l/${list.shareToken}`,
    });
  } catch (err) {
    logger.error('collection fan-out failed', { component: 'follow', listId, err });
  }
}

/** Only for threads anyone can read (no community, or a non-private one). */
export async function notifyFollowersOfDiscussion(actorId: string, discussionId: string): Promise<void> {
  try {
    const d = await prisma.discussion.findUnique({
      where: { id: discussionId },
      select: { title: true, community: { select: { name: true, visibility: true, status: true } } },
    });
    if (!d) return;
    if (d.community && (d.community.visibility === 'PRIVATE' || d.community.status === 'DELETED')) return;
    const actor = await actorLabel(actorId);
    if (!actor) return;
    const where = d.community ? ` in ${d.community.name}` : '';
    await notifyFollowers({
      actorId,
      type: 'FOLLOWING_COMMUNITY',
      title: `${actor.text} is active in the community`,
      body: `${actor.text}, who you follow, started a discussion${where}: “${clip(d.title)}”.`,
      linkUrl: `/discussions/${discussionId}`,
    });
  } catch (err) {
    logger.error('discussion fan-out failed', { component: 'follow', discussionId, err });
  }
}

/* ── Creators only: ratings and hype (2026-10-24) ─────────────────────────
   Followers of a creator also hear when the creator rates an anime or is
   hyped for one. Ordinary members' ratings and hype stay quiet (that would
   be noise). One notification per creator per anime per kind: re-rating
   doesn't send another (the link names the creator, so it is the dedupe key). */

async function creatorActor(actorId: string) {
  const u = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true, displayName: true, role: true } });
  return u && u.role === 'CREATOR' ? { username: u.username, text: label(u) } : null;
}

async function animeFor(animeId: string) {
  return prisma.anime.findUnique({ where: { id: animeId }, select: { id: true, slug: true, canonicalTitle: true, titles: true } });
}

const creatorAnimeLink = (anime: { slug: string | null; id: string }, username: string) =>
  `/anime/${anime.slug || anime.id}?creator=${encodeURIComponent(username)}#creators`;

export async function notifyFollowersOfCreatorRating(actorId: string, animeId: string, score: number): Promise<void> {
  try {
    const actor = await creatorActor(actorId);
    if (!actor) return;
    const anime = await animeFor(animeId);
    if (!anime) return;
    const title = getAnimeDisplayTitle(anime as any);
    await notifyFollowers({
      actorId,
      type: 'FOLLOWING_RATING',
      title: `${actor.text} rated ${clip(title, 60)}`,
      body: `${actor.text}, who you follow, gave ${title} ${score.toFixed(1)}/10.`,
      linkUrl: creatorAnimeLink(anime, actor.username),
    });
  } catch (err) {
    logger.error('creator rating fan-out failed', { component: 'follow', animeId, err });
  }
}

export async function notifyFollowersOfCreatorHype(actorId: string, animeId: string): Promise<void> {
  try {
    const actor = await creatorActor(actorId);
    if (!actor) return;
    const anime = await animeFor(animeId);
    if (!anime) return;
    const title = getAnimeDisplayTitle(anime as any);
    await notifyFollowers({
      actorId,
      type: 'FOLLOWING_HYPE',
      title: `${actor.text} is hyped for ${clip(title, 60)}`,
      body: `${actor.text}, who you follow, is hyped for ${title}.`,
      linkUrl: creatorAnimeLink(anime, actor.username),
    });
  } catch (err) {
    logger.error('creator hype fan-out failed', { component: 'follow', animeId, err });
  }
}
