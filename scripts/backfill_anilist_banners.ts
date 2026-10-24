/**
 * OTAKUVA — backfill real banner art from AniList (dry run by default)
 * Usage: npx tsx scripts/backfill_anilist_banners.ts [--apply]
 *
 * Most of the catalog came in via Jikan, which has no banner art, so hero
 * backgrounds fell back to stretching a small portrait poster (and 14 rows
 * even had the MAL poster stored in `bannerUrl`). AniList has proper
 * 1900x400 banners and can be queried by MAL id, 50 per request.
 *
 * Writes `bannerUrl` only when the current value is not already a real
 * banner, never where an EditorialOverride owns the field, and never clears
 * anything. Also fills `anilistId` when it is missing (pure provenance).
 */
import { prisma } from '../src/lib/prisma';
import { anilistProvider } from '../src/lib/providers/anilistProvider';
import { isWideBanner } from '../src/lib/media/heroArt';

const APPLY = process.argv.includes('--apply');

async function main() {
  const candidates = await prisma.anime.findMany({
    where: { malId: { not: null }, status: { not: 'MERGED' } },
    select: { id: true, malId: true, anilistId: true, bannerUrl: true, canonicalTitle: true },
  });
  const overridden = new Set(
    (
      await prisma.editorialOverride.findMany({
        where: { entityType: 'ANIME', field: { in: ['bannerUrl', 'bannerImage'] } },
        select: { entityId: true },
      })
    ).map((o) => o.entityId)
  );
  const todo = candidates.filter((a) => !isWideBanner(a.bannerUrl) && !overridden.has(a.id));
  console.log(`${candidates.length} anime with a MAL id; ${todo.length} without a real banner (${overridden.size} skipped: editorial override).`);

  let found = 0;
  let written = 0;
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const banners = await anilistProvider.getBannersByMalIds(batch.map((a) => a.malId as number));
    for (const a of batch) {
      const hit = banners.get(a.malId as number);
      if (!hit) continue;
      found++;
      if (APPLY) {
        await prisma.anime.update({
          where: { id: a.id },
          data: { bannerUrl: hit.bannerUrl, ...(a.anilistId ? {} : { anilistId: hit.anilistId }) },
        });
        written++;
      }
    }
    console.log(`  ${Math.min(i + 50, todo.length)}/${todo.length} checked — ${found} banners found`);
  }
  console.log(APPLY ? `Done: ${written} banners written.` : `Dry run: ${found} banners would be written. Re-run with --apply.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
