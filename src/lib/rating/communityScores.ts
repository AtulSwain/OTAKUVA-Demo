import { prisma } from '../prisma';
import { getAnimeRetentions } from './animeRetention';
import type { RetentionBadgeKey, RetentionStatus } from './retentionScore';

/**
 * Members' figures for many anime at once — what every card and poster shows
 * instead of the provider (MAL/AniList) score (2026-10-21, owner).
 *
 * - `score`: the OTAKUVA score, the same number the anime page shows
 *   (RatingAggregate.rawAverage, one counted score per member — see
 *   `recalculateAnimeAggregates`). Null until a member has rated it.
 * - `retention`: the anime's community retention (whole percent) — the mean
 *   of its rated episodes' scores, exactly as the anime page shows it
 *   (`retentionScore.ts`), with its status (unrated / provisional / rated)
 *   and badge (only once there's enough data). Null until someone rated an
 *   episode. Cards show this, not the 1–10 score (2026-10-25, owner).
 *
 * Nothing is filled in: an anime nobody rated has nulls and cards show nothing.
 */
export type CommunityScore = {
  score: number | null;
  ratingCount: number;
  retention: number | null;
  retentionMembers: number;
  retentionStatus: RetentionStatus;
  retentionBadge: RetentionBadgeKey | null;
  ratedEpisodes: number;
  retentionRatings: number;
  /**
   * "Verdicts" (owner, 2026-10-26): different members who rated an episode
   * (retention) OR published a review of the anime — each member counted
   * once, whichever they did. Shown on ranked cards ("12 verdicts").
   */
  verdicts: number;
};

export const MAX_COMMUNITY_SCORE_IDS = 200;

export async function getCommunityScores(animeIds: string[]): Promise<Record<string, CommunityScore>> {
  const ids = Array.from(new Set(animeIds.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 64))).slice(
    0,
    MAX_COMMUNITY_SCORE_IDS
  );
  if (ids.length === 0) return {};

  const [aggregates, retention, retentionMembers, reviewers] = await Promise.all([
    prisma.ratingAggregate.findMany({
      where: { animeId: { in: ids }, ratingCount: { gt: 0 } },
      select: { animeId: true, ratingCount: true, rawAverage: true },
    }),
    getAnimeRetentions(ids),
    prisma.episodeRating.groupBy({
      by: ['animeId', 'userId'],
      where: { animeId: { in: ids }, episodeNumber: { not: null }, retention: { gte: 1, lte: 100 } },
    }),
    prisma.review.groupBy({
      by: ['animeId', 'userId'],
      where: { animeId: { in: ids }, status: 'PUBLISHED', deletedAt: null },
    }),
  ]);
  const verdictMembers = new Map<string, Set<string>>();
  for (const r of [...retentionMembers, ...reviewers]) {
    if (!r.animeId) continue;
    const set = verdictMembers.get(r.animeId) ?? new Set<string>();
    set.add(r.userId);
    verdictMembers.set(r.animeId, set);
  }

  const out: Record<string, CommunityScore> = {};
  const entry = (id: string) =>
    (out[id] ??= {
      score: null,
      ratingCount: 0,
      retention: null,
      retentionMembers: 0,
      retentionStatus: 'unrated',
      retentionBadge: null,
      ratedEpisodes: 0,
      retentionRatings: 0,
      verdicts: 0,
    });

  for (const a of aggregates) {
    if (a.rawAverage === null) continue;
    const e = entry(a.animeId);
    e.score = a.rawAverage;
    e.ratingCount = a.ratingCount;
  }

  for (const [animeId, r] of retention) {
    if (r.status === 'unrated') continue;
    const e = entry(animeId);
    e.retention = r.value;
    e.retentionMembers = r.raters;
    e.retentionStatus = r.status;
    e.retentionBadge = r.badge;
    e.ratedEpisodes = r.ratedEpisodes;
    e.retentionRatings = r.totalRatings;
  }

  for (const [animeId, members] of verdictMembers) entry(animeId).verdicts = members.size;

  return out;
}
