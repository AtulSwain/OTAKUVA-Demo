/**
 * Creators on the homepage (2026-10-24): every creator account, most
 * followed first, shown as story-style circles, plus a feed of what
 * creators recently did — rated an anime, published a Creator Review, or
 * got hyped for an upcoming one. Public data only (ratings, published
 * reviews and hype are already public); nothing is invented — no creators
 * means the section doesn't render.
 */
import { prisma } from '../prisma';
import { resolveAvatarUrl } from '../mediaResolver';
import { getAnimeDisplayTitle } from '../animeTitleResolver';

export interface CreatorCard {
  username: string;
  displayName: string | null;
  channelName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  /** When they last rated / reviewed / hyped anything (drives the "new" ring). */
  lastActiveAt: string | null;
}

export interface CreatorFeedItem {
  kind: 'RATED' | 'REVIEWED' | 'HYPED';
  at: string;
  creator: { username: string; name: string; avatarUrl: string | null };
  anime: { id: string; slug: string; title: string; posterUrl: string | null };
  score: number | null;
  review: { id: string; title: string } | null;
}

const ANIME = { select: { id: true, slug: true, canonicalTitle: true, posterUrl: true, titles: true, isAdult: true } } as const;
const USER = { select: { id: true, username: true, displayName: true, avatarUrl: true, creatorChannelName: true } } as const;

export async function getCreatorDirectory(opts: { limit?: number; feedLimit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 60);
  const feedLimit = Math.min(Math.max(opts.feedLimit ?? 8, 0), 30);
  const creatorOnly = { role: 'CREATOR' };

  const creators = await prisma.user.findMany({
    where: creatorOnly,
    select: { id: true, username: true, displayName: true, avatarUrl: true, creatorChannelName: true, creatorSince: true },
  });
  if (creators.length === 0) return { creators: [] as CreatorCard[], feed: [] as CreatorFeedItem[] };
  const ids = creators.map((c) => c.id);

  const [followerCounts, ratings, reviews, hypes] = await Promise.all([
    prisma.follow.groupBy({ by: ['followingId'], where: { followingId: { in: ids } }, _count: { _all: true } }),
    prisma.animeRating.findMany({
      where: { userId: { in: ids }, deletedAt: null, anime: { isAdult: false } },
      orderBy: { updatedAt: 'desc' },
      take: 60,
      select: { rating: true, updatedAt: true, user: USER, anime: ANIME },
    }),
    prisma.review.findMany({
      where: { userId: { in: ids }, status: 'PUBLISHED', deletedAt: null, isCreatorReview: true, anime: { isAdult: false } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, title: true, createdAt: true, user: USER, anime: ANIME },
    }),
    prisma.animeHype.findMany({
      where: { userId: { in: ids }, level: 'HYPED', anime: { isAdult: false } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { createdAt: true, user: USER, anime: ANIME },
    }),
  ]);

  const followers = new Map(followerCounts.map((f) => [f.followingId, f._count._all]));
  const lastActive = new Map<string, Date>();
  const bump = (id: string, at: Date) => {
    const prev = lastActive.get(id);
    if (!prev || at > prev) lastActive.set(id, at);
  };
  ratings.forEach((r) => bump(r.user.id, r.updatedAt));
  reviews.forEach((r) => bump(r.user.id, r.createdAt));
  hypes.forEach((h) => bump(h.user.id, h.createdAt));

  const cards: CreatorCard[] = creators
    .map((c) => ({
      username: c.username,
      displayName: c.displayName,
      channelName: c.creatorChannelName,
      avatarUrl: resolveAvatarUrl(c.avatarUrl),
      followerCount: followers.get(c.id) ?? 0,
      lastActiveAt: lastActive.get(c.id)?.toISOString() ?? null,
    }))
    .sort((a, b) => b.followerCount - a.followerCount || (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '') || a.username.localeCompare(b.username))
    .slice(0, limit);

  type U = { username: string; displayName: string | null; avatarUrl: string | null; creatorChannelName: string | null };
  type A = { id: string; slug: string; canonicalTitle: string; posterUrl: string; titles?: unknown };
  const who = (u: U) => ({ username: u.username, name: u.creatorChannelName || u.displayName || u.username, avatarUrl: resolveAvatarUrl(u.avatarUrl) });
  const what = (a: A) => ({ id: a.id, slug: a.slug, title: getAnimeDisplayTitle(a as any), posterUrl: a.posterUrl || null });
  // A review already shows its score — skip the matching rating row.
  const reviewed = new Set(reviews.map((r) => `${r.user.username}|${r.anime.slug}`));

  const feed: CreatorFeedItem[] = [
    ...reviews.map((r) => ({ kind: 'REVIEWED' as const, at: r.createdAt.toISOString(), creator: who(r.user), anime: what(r.anime), score: null, review: { id: r.id, title: r.title } })),
    ...ratings
      .filter((r) => !reviewed.has(`${r.user.username}|${r.anime.slug}`))
      .map((r) => ({ kind: 'RATED' as const, at: r.updatedAt.toISOString(), creator: who(r.user), anime: what(r.anime), score: r.rating, review: null })),
    ...hypes.map((h) => ({ kind: 'HYPED' as const, at: h.createdAt.toISOString(), creator: who(h.user), anime: what(h.anime), score: null, review: null })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, feedLimit);

  return { creators: cards, feed };
}
