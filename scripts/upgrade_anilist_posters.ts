/**
 * Points Anime.posterUrl at AniList's extraLarge cover (~460px wide) instead
 * of its `large` cover (~230px), which looked soft/grainy when scaled up.
 *
 * Safe by construction:
 *   - only rows whose posterUrl is an AniList `/cover/medium/` or
 *     `/cover/small/` file AND whose largePosterUrl is the `/cover/large/`
 *     version of the same file (same provider, same image — nothing new is
 *     fetched or invented)
 *   - skips any anime with an EditorialOverride on posterUrl
 *   - every change is logged to AnimeMetadataHistory (source
 *     "poster-resolution") with old and new values
 *   - the AniList adapter now maps extraLarge first, so a later sync keeps it
 *
 * Usage:
 *   npx tsx scripts/upgrade_anilist_posters.ts           (dry run)
 *   npx tsx scripts/upgrade_anilist_posters.ts --apply
 */
import { prisma } from '../src/lib/prisma';

const apply = process.argv.includes('--apply');

const SMALL = /\/media\/anime\/cover\/(?:medium|small)\/([^/?#]+)$/;
const LARGE = /\/media\/anime\/cover\/large\/([^/?#]+)$/;

async function main() {
  const rows = await prisma.anime.findMany({
    where: { posterUrl: { contains: '/media/anime/cover/' }, largePosterUrl: { contains: '/media/anime/cover/large/' } },
    select: { id: true, slug: true, posterUrl: true, largePosterUrl: true },
  });
  const overridden = new Set(
    (
      await prisma.editorialOverride.findMany({
        where: { entityType: 'ANIME', field: { in: ['posterUrl', 'posterImage'] } },
        select: { entityId: true },
      })
    ).map((o) => o.entityId)
  );

  const changes = rows.filter((r) => {
    if (overridden.has(r.id) || !r.largePosterUrl) return false;
    const a = r.posterUrl.match(SMALL);
    const b = r.largePosterUrl.match(LARGE);
    return Boolean(a && b && a[1] === b[1]);
  });

  console.log(`${rows.length} AniList posters checked, ${changes.length} to upgrade, ${overridden.size} editorial overrides respected.`);
  for (const c of changes.slice(0, 5)) console.log(`  ${c.slug}: ${c.posterUrl} -> ${c.largePosterUrl}`);
  if (!apply) {
    console.log('Dry run. Re-run with --apply to write.');
    return;
  }

  let done = 0;
  for (let i = 0; i < changes.length; i += 200) {
    const batch = changes.slice(i, i + 200);
    await prisma.$transaction([
      ...batch.map((c) => prisma.anime.update({ where: { id: c.id }, data: { posterUrl: c.largePosterUrl! } })),
      prisma.animeMetadataHistory.createMany({
        data: batch.map((c) => ({
          animeId: c.id,
          field: 'posterUrl',
          oldValue: c.posterUrl,
          newValue: c.largePosterUrl,
          source: 'poster-resolution',
        })),
      }),
    ]);
    done += batch.length;
    console.log(`  ${done}/${changes.length}`);
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
