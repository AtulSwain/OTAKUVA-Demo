/**
 * OTAKUVA — REAL-WORLD BROADCAST SCHEDULE SYNC
 * Usage: npx tsx scripts/sync_broadcast_schedule.ts
 *
 * Computes AiringSchedule rows from the weekly broadcast slot
 * (broadcastDay/broadcastTime/broadcastTimezone) already stored on every
 * "Currently Airing" Anime record — no external API calls, just DB reads
 * plus timezone math (see ScheduleEngine.syncFromBroadcastMetadata).
 *
 * Safe to re-run anytime (idempotent upsert per anime+episode). Needed
 * periodically because a computed "next occurrence" goes stale once that
 * slot airs — there's no background job scheduler in this repo yet
 * (tracked in CLAUDE.md's Phase 10 backlog), so until one exists, re-run
 * this by hand (or via `POST /api/admin/sync {"action":"SYNC_BROADCAST_SCHEDULE"}`)
 * whenever the schedule looks stale. The full-catalog crawl also calls this
 * automatically every so often as it discovers newly-airing titles.
 */

import { prisma } from '../src/lib/prisma';
import { ScheduleEngine } from '../src/lib/engine/schedule/scheduleEngine';

async function main() {
  console.log('Syncing real-world broadcast schedule from stored Jikan broadcast metadata...\n');
  const res = await ScheduleEngine.syncFromBroadcastMetadata();
  console.log(JSON.stringify(res, null, 2));

  const total = await prisma.airingSchedule.count();
  console.log(`\nTotal AiringSchedule rows now in DB: ${total}`);
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
