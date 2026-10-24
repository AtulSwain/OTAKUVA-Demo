/**
 * OTAKUVA — STAFF/CHARACTER BACKFILL (Jikan)
 *
 * Most of the catalog was ingested without its characters/staff (see the
 * 2026-09-11 audit and CLAUDE.md's Phase 10 backlog) — the full-catalog id
 * crawl (`full_catalog_sync.ts`) only fires these sub-syncs once, at
 * first-ingest time, and never revisits an id once its checkpoint has
 * passed it. This script instead walks every existing Anime row directly
 * (keyed by the `malId` already on the row, no id-space crawling needed)
 * and fills in whatever's still missing — safe to re-run any time: each
 * anime is skipped once it already has both.
 *
 * Anime with no `malId` are left untouched (the two seeded fixture
 * entries — `mind-paradox-*`/`daily-laughs-*` — have none; there is no
 * real provider record to fetch for them, and per CLAUDE.md they're
 * pending owner sign-off for deletion, not enrichment).
 *
 * Usage: npx tsx scripts/backfill_staff_characters.ts
 */

import { prisma } from '../src/lib/prisma';
import { syncEngine } from '../src/lib/syncEngine';

async function main() {
  const animeRows = await prisma.anime.findMany({
    where: { malId: { not: null } },
    select: {
      id: true,
      canonicalTitle: true,
      malId: true,
      _count: { select: { staff: true, characters: true } },
    },
    orderBy: { canonicalTitle: 'asc' },
  });

  console.log(`[backfill] ${animeRows.length} anime have a malId; checking each for missing staff/characters.\n`);

  let staffAdded = 0;
  let charsAdded = 0;
  let skipped = 0;
  let errored = 0;

  for (const anime of animeRows) {
    const needsStaff = anime._count.staff === 0;
    const needsChars = anime._count.characters === 0;
    if (!needsStaff && !needsChars) {
      skipped++;
      continue;
    }

    try {
      const [staffCount, charCount] = await Promise.all([
        needsStaff ? syncEngine.syncStaff(anime.id, String(anime.malId), 'jikan') : Promise.resolve(0),
        needsChars ? syncEngine.syncCharacters(anime.id, String(anime.malId), 'jikan') : Promise.resolve(0),
      ]);
      staffAdded += staffCount;
      charsAdded += charCount;
      console.log(
        `[backfill] ${anime.canonicalTitle} (mal:${anime.malId}) — ` +
        `${needsStaff ? `+${staffCount} staff` : 'staff already present'}, ` +
        `${needsChars ? `+${charCount} characters` : 'characters already present'}`
      );
    } catch (err: any) {
      errored++;
      console.warn(`[backfill] FAILED for ${anime.canonicalTitle} (mal:${anime.malId}): ${err?.message || err}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`  BACKFILL COMPLETE`);
  console.log(`  ${animeRows.length - skipped} anime touched, ${skipped} already complete, ${errored} errored`);
  console.log(`  +${staffAdded} staff links, +${charsAdded} character links added`);
  console.log('========================================================================\n');
}

main()
  .catch((error) => {
    console.error('[backfill] Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
