/**
 * A member's anime on their profile's "Rated" tab — by RETENTION since
 * 2026-10-25 (owner removed the 1–10 stars): every anime they rated episodes
 * of, with their own retention (the average of those episode ratings, whole
 * percent), most recently rated first. Each row says whether the member also
 * published a review of that anime. Old star ratings stay stored, unshown.
 */
import { prisma } from '../prisma';
import { getAnimeDisplayTitle } from '../animeTitleResolver';

export interface PublicRating {
  anime: { id: string; slug: string; title: string; posterUrl: string | null; year: number | null; type: string | null };
  /** The member's retention for the anime, 1–100. */
  retention: number;
  /** Episodes of it they rated. */
  episodes: number;
  ratedAt: string;
  reviewed: boolean;
}

export async function getPublicRatings(
  username: string,
  opts: { before?: string | null; limit?: number } = {}
): Promise<{ items: PublicRating[]; total: number; nextCursor: string | null } | null> {
  const user = await prisma.user.findFirst({ where: { username }, select: { id: true } });
  if (!user) return null;
  const limit = Math.min(Math.max(opts.limit ?? 36, 1), 60);
  const before = opts.before ? new Date(opts.before) : null;

  const groups = await prisma.episodeRating.groupBy({
    by: ['animeId'],
    where: { userId: user.id, animeId: { not: null }, episodeNumber: { not: null }, retention: { gte: 1, lte: 100 } },
    _avg: { retention: true },
    _count: { retention: true },
    _max: { updatedAt: true },
  });
  const sorted = groups
    .filter((g) => g.animeId && g._max.updatedAt && (!before || isNaN(+before) || g._max.updatedAt < before))
    .sort((a, b) => b._max.updatedAt!.getTime() - a._max.updatedAt!.getTime());
  const page = sorted.slice(0, limit);
  const ids = page.map((g) => g.animeId!) as string[];

  const [anime, reviewedRows] = await Promise.all([
    prisma.anime.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true, canonicalTitle: true, posterUrl: true, year: true, startYear: true, type: true, titles: true },
    }),
    prisma.review.findMany({ where: { userId: user.id, deletedAt: null, status: 'PUBLISHED', animeId: { in: ids } }, select: { animeId: true } }),
  ]);
  const byId = new Map(anime.map((a) => [a.id, a]));
  const reviewed = new Set(reviewedRows.map((r) => r.animeId));

  return {
    items: page.flatMap((g) => {
      const a = byId.get(g.animeId!);
      if (!a) return [];
      return [
        {
          anime: {
            id: a.id,
            slug: a.slug,
            title: getAnimeDisplayTitle(a as any),
            posterUrl: a.posterUrl || null,
            year: a.year ?? a.startYear ?? null,
            type: a.type ?? null,
          },
          retention: Math.round(g._avg.retention ?? 0),
          episodes: g._count.retention,
          ratedAt: g._max.updatedAt!.toISOString(),
          reviewed: reviewed.has(a.id),
        },
      ];
    }),
    total: groups.length,
    nextCursor: sorted.length > limit ? page[page.length - 1]._max.updatedAt!.toISOString() : null,
  };
}
