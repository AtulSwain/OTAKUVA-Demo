/**
 * OTAKUVA — import official streaming links from AniList (dry run by default)
 * Usage: npx tsx scripts/backfill_streaming_links.ts [--apply] [--all]
 *
 * Default scope is everything on the schedule in the next week with no
 * streaming listing yet (the schedule page's "where to watch"). --all
 * widens it to every anime with an AniList or MAL id. Add-only: see
 * src/lib/catalog/streamingLinks.ts for the safety rules.
 */
import { prisma } from '../src/lib/prisma';
import { syncStreamingLinks } from '../src/lib/catalog/streamingLinks';

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');

async function main() {
  const now = Date.now();
  const ids = ALL
    ? (await prisma.anime.findMany({
        where: { status: { not: 'MERGED' }, OR: [{ anilistId: { not: null } }, { malId: { not: null } }] },
        select: { id: true },
      })).map((a) => a.id)
    : (await prisma.airingSchedule.findMany({
        where: { airingAt: { gte: new Date(now - 86_400_000), lte: new Date(now + 8 * 86_400_000) } },
        select: { animeId: true },
        distinct: ['animeId'],
      })).map((r) => r.animeId);

  console.log(`${ids.length} anime in scope (${ALL ? 'whole catalog' : 'scheduled this week'}).`);
  const res = await syncStreamingLinks(ids, { apply: APPLY });
  console.log(`Checked ${res.checked} with a provider id; AniList answered for ${res.answered}; ${res.linksFound} streaming links found.`);
  console.log(APPLY ? `Done: ${res.rowsWritten} new rows written.` : 'Dry run — nothing written. Re-run with --apply.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
