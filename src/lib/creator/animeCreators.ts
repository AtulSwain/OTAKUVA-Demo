/**
 * "Creators on this anime" (2026-10-24): every creator account that rated,
 * reviewed (published Creator Review) or is hyped for one anime — public,
 * for everyone, followers or not. Ordered by follower count, so the
 * creators with the biggest audience come first. Ratings are the creator's
 * real AnimeRating; nothing is shown for a creator who did none of these.
 */
import { prisma } from '../prisma';
import { resolveAvatarUrl } from '../mediaResolver';

export interface AnimeCreatorItem {
  username: string;
  displayName: string | null;
  channelName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  rating: number | null;
  review: { id: string; title: string } | null;
  hyped: boolean;
  /** Whether the viewer follows them (null when signed out). */
  viewerFollows: boolean | null;
  isViewer: boolean;
}

const MAX = 20;

export async function getAnimeCreators(animeIdOrSlug: string, viewerId?: string | null): Promise<AnimeCreatorItem[] | null> {
  const anime = await prisma.anime.findFirst({ where: { OR: [{ id: animeIdOrSlug }, { slug: animeIdOrSlug }] }, select: { id: true } });
  if (!anime) return null;
  const creatorOnly = { role: 'CREATOR' };

  const [ratings, reviews, hypes] = await Promise.all([
    prisma.animeRating.findMany({ where: { animeId: anime.id, deletedAt: null, user: creatorOnly }, select: { userId: true, rating: true } }),
    prisma.review.findMany({
      where: { animeId: anime.id, status: 'PUBLISHED', deletedAt: null, user: creatorOnly },
      select: { id: true, userId: true, title: true },
    }),
    prisma.animeHype.findMany({ where: { animeId: anime.id, level: 'HYPED', user: creatorOnly }, select: { userId: true } }),
  ]);
  const ids = Array.from(new Set([...ratings.map((r) => r.userId), ...reviews.map((r) => r.userId), ...hypes.map((h) => h.userId)]));
  if (ids.length === 0) return [];

  const [users, followerCounts, mine] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, displayName: true, avatarUrl: true, creatorChannelName: true },
    }),
    prisma.follow.groupBy({ by: ['followingId'], where: { followingId: { in: ids } }, _count: { _all: true } }),
    viewerId
      ? prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: ids } }, select: { followingId: true } })
      : Promise.resolve([]),
  ]);
  const followers = new Map(followerCounts.map((f) => [f.followingId, f._count._all]));
  const rating = new Map(ratings.map((r) => [r.userId, r.rating]));
  const review = new Map(reviews.map((r) => [r.userId, { id: r.id, title: r.title }]));
  const hyped = new Set(hypes.map((h) => h.userId));
  const following = new Set(mine.map((m) => m.followingId));

  return users
    .map((u) => ({
      username: u.username,
      displayName: u.displayName,
      channelName: u.creatorChannelName,
      avatarUrl: resolveAvatarUrl(u.avatarUrl),
      followerCount: followers.get(u.id) ?? 0,
      rating: rating.get(u.id) ?? null,
      review: review.get(u.id) ?? null,
      hyped: hyped.has(u.id),
      viewerFollows: viewerId ? following.has(u.id) : null,
      isViewer: viewerId === u.id,
    }))
    .sort((a, b) => b.followerCount - a.followerCount || a.username.localeCompare(b.username))
    .slice(0, MAX);
}
