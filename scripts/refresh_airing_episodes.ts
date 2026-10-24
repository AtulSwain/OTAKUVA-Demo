/**
 * OTAKUVA — CURRENTLY-AIRING EPISODE REFRESH
 *
 * The weekly-broadcast-slot schedule (`ScheduleEngine.syncFromBroadcastMetadata`)
 * deliberately refuses to guess a "next episode" number unless the anime's
 * own imported episode list is current — a stale/truncated import (e.g. a
 * long runner whose last recorded episode is years old) means it's skipped
 * rather than shown with a fabricated episode number. That's why the
 * schedule page reads as empty for "Today"/"This Week": every currently-
 * airing anime in the catalog has either no episode rows or ones that are
 * thousands of days stale (see the 2026-09-11 audit).
 *
 * This re-syncs episodes (full pagination, not just page 1 — see
 * syncEngine.syncEpisodes) for every anime with status "Currently Airing"
 * only — a small, targeted set, not a full-catalog crawl — then re-runs the
 * broadcast-metadata schedule sync so freshly-current shows can actually
 * populate the schedule immediately.
 *
 * Safe to re-run any time. If Jikan/MAL's episode endpoint is degraded,
 * individual titles simply fail (logged) with everything else unaffected —
 * no anime record is ever touched destructively.
 *
 * Usage: npx tsx scripts/refresh_airing_episodes.ts
 */

import { prisma } from '../src/lib/prisma';
import { syncEngine } from '../src/lib/syncEngine';
import { ScheduleEngine } from '../src/lib/engine/schedule/scheduleEngine';

async function main() {
  const airing = await prisma.anime.findMany({
    where: { status: 'Currently Airing', malId: { not: null } },
    select: { id: true, canonicalTitle: true, malId: true },
    orderBy: { canonicalTitle: 'asc' },
  });

  console.log(`[refresh] ${airing.length} currently-airing anime with a malId.\n`);

  let succeeded = 0;
  let failed = 0;
  let totalEpisodesSynced = 0;

  for (const anime of airing) {
    try {
      const count = await syncEngine.syncEpisodes(anime.id, String(anime.malId), 'jikan');
      totalEpisodesSynced += count;
      console.log(`[refresh] ${anime.canonicalTitle} (mal:${anime.malId}) — ${count} episodes synced`);
      succeeded++;
    } catch (err: any) {
      failed++;
      console.warn(`[refresh] FAILED for ${anime.canonicalTitle} (mal:${anime.malId}): ${err?.message || err}`);
    }
  }

  console.log(`\n[refresh] Episode sync: ${succeeded} succeeded, ${failed} failed, ${totalEpisodesSynced} episode rows touched.`);

  console.log('\n[refresh] Re-running broadcast-metadata schedule sync with fresh episode data...');
  const scheduleRes = await ScheduleEngine.syncFromBroadcastMetadata();
  console.log('[refresh] Schedule sync result:', scheduleRes);

  console.log('\n========================================================================');
  console.log('  AIRING EPISODE REFRESH COMPLETE');
  console.log('========================================================================\n');
}

main()
  .catch((error) => {
    console.error('[refresh] Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
