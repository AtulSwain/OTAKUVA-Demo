/**
 * A member's anime ratings, as shown on their profile's "Rated" tab. Ratings
 * are public (they already appear in profile activity and on review cards);
 * soft-deleted ratings never show. Each row says whether the member also
 * published a review of that anime.
 */
import { prisma } from '../prisma';
import { getAnimeDisplayTitle } from '../animeTitleResolver';

export interface PublicRating {
  anime: { id: string; slug: string; title: string; posterUrl: string | null; year: number | null; type: string | null };
  score: number;
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
  const where = { userId: user.id, deletedAt: null };

  const [rows, total] = await Promise.all([
    prisma.animeRating.findMany({
      where: { ...where, ...(before && !isNaN(+before) ? { updatedAt: { lt: before } } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      select: {
        rating: true,
        updatedAt: true,
        anime: {
          select: { id: true, slug: true, canonicalTitle: true, posterUrl: true, year: true, startYear: true, type: true, titles: true },
        },
      },
    }),
    prisma.animeRating.count({ where }),
  ]);
  const page = rows.slice(0, limit);

  const reviewed = new Set(
    (
      await prisma.review.findMany({
        where: { userId: user.id, deletedAt: null, status: 'PUBLISHED', animeId: { in: page.map((r) => r.anime.id) } },
        select: { animeId: true },
      })
    ).map((r) => r.animeId)
  );

  return {
    items: page.map((r) => ({
      anime: {
        id: r.anime.id,
        slug: r.anime.slug,
        title: getAnimeDisplayTitle(r.anime as any),
        posterUrl: r.anime.posterUrl || null,
        year: r.anime.year ?? r.anime.startYear ?? null,
        type: r.anime.type ?? null,
      },
      score: r.rating,
      ratedAt: r.updatedAt.toISOString(),
      reviewed: reviewed.has(r.anime.id),
    })),
    total,
    nextCursor: rows.length > limit ? page[page.length - 1].updatedAt.toISOString() : null,
  };
}
