/**
 * OTAKUVA — sharper posters from AniList (dry run by default)
 * Usage: npx tsx scripts/backfill_anilist_posters.ts [--apply]
 *
 * Follow-up to upgrade_anilist_posters.ts. That one fixed rows that already
 * had AniList's large cover stored; this one fetches it for the rest:
 *   - Jikan-imported anime whose poster is MyAnimeList's ~225px file
 *     (MAL has nothing bigger), looked up by AniList id, else by MAL id;
 *   - AniList rows still on a small `/cover/medium|small/` file.
 * AniList's `coverImage.extraLarge` (~460px) is the same anime's official
 * cover art, matched by provider id — never by title.
 *
 * Writes posterUrl + largePosterUrl only; skips EditorialOverride rows;
 * fills a missing anilistId (provenance); every change is logged to
 * AnimeMetadataHistory (source "poster-resolution-anilist"). A later Jikan
 * re-sync of a row may put the MAL poster back — re-run this after imports.
 */
import { prisma } from '../src/lib/prisma';
import { anilistProvider } from '../src/lib/providers/anilistProvider';

const APPLY = process.argv.includes('--apply');
const SHARP = /anilistcdn\/media\/anime\/cover\/large\//;

async function main() {
  const rows = await prisma.anime.findMany({
    where: { status: { not: 'MERGED' }, OR: [{ anilistId: { not: null } }, { malId: { not: null } }] },
    select: { id: true, slug: true, anilistId: true, malId: true, posterUrl: true, largePosterUrl: true },
  });
  const overridden = new Set(
    (
      await prisma.editorialOverride.findMany({
        where: { entityType: 'ANIME', field: { in: ['posterUrl', 'posterImage'] } },
        select: { entityId: true },
      })
    ).map((o) => o.entityId)
  );
  const todo = rows.filter((r) => !SHARP.test(r.posterUrl || '') && !overridden.has(r.id));
  const byAnilist = todo.filter((r) => r.anilistId);
  const byMal = todo.filter((r) => !r.anilistId && r.malId);
  console.log(`${todo.length} posters to improve (${byAnilist.length} by AniList id, ${byMal.length} by MAL id; ${overridden.size} editorial overrides skipped).`);

  type Change = { id: string; slug: string; from: string; to: string; anilistId: number | null };
  const changes: Change[] = [];
  const run = async (list: typeof todo, by: 'anilist' | 'mal') => {
    for (let i = 0; i < list.length; i += 50) {
      const batch = list.slice(i, i + 50);
      const ids = batch.map((r) => (by === 'anilist' ? r.anilistId : r.malId) as number);
      const covers = await anilistProvider.getCoversByIds(ids, by);
      for (const r of batch) {
        const hit = covers.get((by === 'anilist' ? r.anilistId : r.malId) as number);
        if (!hit || hit.extraLarge === r.posterUrl) continue;
        changes.push({ id: r.id, slug: r.slug, from: r.posterUrl, to: hit.extraLarge, anilistId: r.anilistId ? null : hit.anilistId });
      }
      console.log(`  ${by}: ${Math.min(i + 50, list.length)}/${list.length} checked — ${changes.length} sharper covers found`);
    }
  };
  await run(byAnilist, 'anilist');
  await run(byMal, 'mal');

  for (const c of changes.slice(0, 5)) console.log(`  ${c.slug}: ${c.from} -> ${c.to}`);
  if (!APPLY) {
    console.log(`Dry run: ${changes.length} posters would be upgraded. Re-run with --apply.`);
    return;
  }

  for (let i = 0; i < changes.length; i += 100) {
    const batch = changes.slice(i, i + 100);
    await prisma.$transaction([
      ...batch.map((c) =>
        prisma.anime.update({
          where: { id: c.id },
          data: { posterUrl: c.to, largePosterUrl: c.to, ...(c.anilistId ? { anilistId: c.anilistId } : {}) },
        })
      ),
      prisma.animeMetadataHistory.createMany({
        data: batch.map((c) => ({ animeId: c.id, field: 'posterUrl', oldValue: c.from, newValue: c.to, source: 'poster-resolution-anilist' })),
      }),
    ]);
  }
  console.log(`Done: ${changes.length} posters upgraded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
