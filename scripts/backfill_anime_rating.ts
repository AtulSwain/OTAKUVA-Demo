/**
 * OTAKUVA — AGE/CONTENT RATING BACKFILL (Jikan)
 *
 * A handful of anime — mostly the earliest-seeded, highest-profile titles
 * (Cowboy Bebop, FMAB, Frieren, Attack on Titan, ...) — were ingested
 * before `Anime.rating` was captured on updates (see the fixed gap in
 * `syncEngine.ingestAnime`'s update branch, which never wrote `rating`
 * for an anime that already existed). This fills in just that one field
 * for whatever's still missing, using `/anime/{id}/full` — the one Jikan
 * endpoint that's stayed reliable through the current MAL connectivity
 * outage (see docs/AUDIT_2026-09-11.md / CLAUDE.md's Phase 10 backlog),
 * so this doesn't need to wait for characters/staff/episodes to recover.
 *
 * Safe to re-run any time: only touches rows where `rating` is still null
 * and a real value comes back from the provider; never fabricates one.
 *
 * Usage: npx tsx scripts/backfill_anime_rating.ts
 */

import { prisma } from '../src/lib/prisma';
import { jikanProvider } from '../src/lib/providers/jikanProvider';

async function main() {
  const rows = await prisma.anime.findMany({
    where: { rating: null, malId: { not: null } },
    select: { id: true, canonicalTitle: true, malId: true },
    orderBy: { canonicalTitle: 'asc' },
  });

  console.log(`[backfill] ${rows.length} anime have a malId but no rating on record.\n`);

  let updated = 0;
  let stillUnrated = 0;
  let errored = 0;

  for (const anime of rows) {
    try {
      const provider = await jikanProvider.getAnime(String(anime.malId));
      if (provider?.rating) {
        await prisma.anime.update({ where: { id: anime.id }, data: { rating: provider.rating } });
        updated++;
        console.log(`[backfill] ${anime.canonicalTitle} (mal:${anime.malId}) -> "${provider.rating}"`);
      } else {
        // Provider genuinely has no rating on record for this title — leave
        // it null rather than inventing one.
        stillUnrated++;
        console.log(`[backfill] ${anime.canonicalTitle} (mal:${anime.malId}) — no rating on provider record, left null`);
      }
    } catch (err: any) {
      errored++;
      console.warn(`[backfill] FAILED for ${anime.canonicalTitle} (mal:${anime.malId}): ${err?.message || err}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`  RATING BACKFILL COMPLETE — ${updated} updated, ${stillUnrated} still unrated, ${errored} errored`);
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
