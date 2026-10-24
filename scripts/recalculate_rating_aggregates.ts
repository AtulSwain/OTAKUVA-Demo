/**
 * OTAKUVA — recompute every anime's rating aggregates (RatingAggregate +
 * RatingCategoryAggregate) from the stored AnimeRating rows.
 * Usage: npx tsx scripts/recalculate_rating_aggregates.ts
 *
 * Run after changing how aggregates are computed (e.g. 2026-10-16, when
 * the active aspects went from 8 to 3 and the Vibe percentages had to be
 * re-normalised). Reads ratings, writes only derived aggregate rows —
 * never touches users' ratings.
 */
import { prisma } from '../src/lib/prisma';
import { recalculateAnimeAggregates } from '../src/lib/rating/ratingService';

async function main() {
  const [overall, episodes] = await Promise.all([
    prisma.animeRating.findMany({ where: { deletedAt: null }, select: { animeId: true }, distinct: ['animeId'] }),
    // Legacy per-episode scores still count for members with no overall rating.
    prisma.episodeRating.findMany({ where: { animeId: { not: null }, rating: { not: null } }, select: { animeId: true }, distinct: ['animeId'] }),
  ]);
  const ids = Array.from(new Set([...overall.map((r) => r.animeId), ...episodes.map((r) => r.animeId as string)]));
  console.log(`${ids.length} anime with ratings.`);
  for (const id of ids) await recalculateAnimeAggregates(id);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
