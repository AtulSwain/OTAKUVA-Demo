/**
 * Data for the anime page's badge-aware review section: distribution counts
 * come from the cached aggregate; review lists are a bounded, indexed query
 * (never a live per-tier aggregate).
 */
import { prisma } from '../prisma';
import { BADGE_RULES } from './config';
import { compareCritic, feedScore, helpfulnessScore, isRisingCandidate } from './ranking';
import { criticUserWhere, getAnimeBadgeDistribution } from './queries';
import { isTierKey, type TierKey } from './tiers';

export type HighlightView = 'top' | 'critics';

export interface HighlightReview {
  id: string;
  title: string;
  snippet: string;
  rating: number | null;
  likesCount: number;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null; tier: TierKey; reviewCount: number };
}

export interface AnimeReviewHighlights {
  totalWritten: number;
  distribution: Record<string, number>;
  reviews: HighlightReview[];
  rising: HighlightReview[];
}

const SNIPPET_CHARS = 180;
const CANDIDATES = 150;
const LIST_SIZE = 5;
const RISING_SIZE = 3;

function snippet(body: string): string {
  const t = body.replace(/\s+/g, ' ').trim();
  return t.length <= SNIPPET_CHARS ? t : `${t.slice(0, SNIPPET_CHARS).replace(/\s+\S*$/, '')}…`;
}

export async function getAnimeReviewHighlights(
  animeId: string,
  view: HighlightView,
  now: Date = new Date()
): Promise<AnimeReviewHighlights> {
  const base = { animeId, deletedAt: null, status: 'PUBLISHED', countState: 'COUNTED' } as const;
  const userWhere = view === 'critics' ? criticUserWhere(now) : undefined;

  const select = {
    id: true,
    title: true,
    body: true,
    rating: true,
    likesCount: true,
    createdAt: true,
    user: { select: { id: true, username: true, avatarUrl: true, badgeStats: { select: { currentTier: true, countedReviewCount: true } } } },
  } as const;

  const [totalWritten, distribution, candidates, risingPool] = await Promise.all([
    prisma.review.count({ where: { animeId, deletedAt: null, status: 'PUBLISHED' } }),
    getAnimeBadgeDistribution(animeId),
    prisma.review.findMany({
      where: { ...base, ...(userWhere ? { user: userWhere } : {}) },
      orderBy: [{ likesCount: 'desc' }, { createdAt: 'desc' }],
      take: CANDIDATES,
      select,
    }),
    prisma.review.findMany({
      where: { ...base, createdAt: { gte: new Date(now.getTime() - BADGE_RULES.ranking.risingMaxAgeDays * 86_400_000) } },
      orderBy: [{ likesCount: 'desc' }, { createdAt: 'desc' }],
      take: CANDIDATES,
      select,
    }),
  ]);

  type Row = (typeof candidates)[number];
  const tierOf = (r: Row): TierKey => (r.user.badgeStats && isTierKey(r.user.badgeStats.currentTier) ? r.user.badgeStats.currentTier : 'shoshinsha');
  const input = (r: Row) => ({ helpfulVotes: r.likesCount, createdAt: r.createdAt, tier: tierOf(r), now });
  const shape = (r: Row): HighlightReview => ({
    id: r.id,
    title: r.title,
    snippet: snippet(r.body),
    rating: r.rating,
    likesCount: r.likesCount,
    createdAt: r.createdAt.toISOString(),
    user: {
      id: r.user.id,
      username: r.user.username,
      avatarUrl: r.user.avatarUrl,
      tier: tierOf(r),
      reviewCount: r.user.badgeStats?.countedReviewCount ?? 0,
    },
  });

  // One slot per reviewer per anime is already guaranteed by Review's unique (userId, animeId).
  const ranked =
    view === 'critics'
      ? [...candidates].sort((a, b) => compareCritic(input(a), input(b)))
      : [...candidates].sort((a, b) => feedScore(input(b)) - feedScore(input(a)));
  const top = ranked.slice(0, LIST_SIZE);
  const shown = new Set(top.map((r) => r.id));

  // Rising slot: newer / lower-tier reviewers, ranked WITHOUT any tier boost.
  const rising = risingPool
    .filter((r) => !shown.has(r.id) && isRisingCandidate(tierOf(r), r.createdAt, now))
    .sort((a, b) => helpfulnessScore(input(b)) - helpfulnessScore(input(a)))
    .slice(0, RISING_SIZE);

  // Counted reviews are a subset of published ones, so the total can never be smaller
  // than the cached per-tier sum; take the max so a briefly stale count can't contradict it.
  const cachedSum = Object.values(distribution).reduce((a, n) => a + n, 0);
  return { totalWritten: Math.max(totalWritten, cachedSum), distribution, reviews: top.map(shape), rising: rising.map(shape) };
}
