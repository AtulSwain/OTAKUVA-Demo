/**
 * OTAKUVA — remove schedule rows whose episode number was guessed.
 *
 * Usage:
 *   npx tsx scripts/repair_schedule_fabrications.ts            (dry run, default)
 *   npx tsx scripts/repair_schedule_fabrications.ts --apply
 *
 * ScheduleEngine.syncFromBroadcastMetadata used to schedule "highest
 * imported episode + 1" as a verified release. For long runners whose
 * episode import stopped years ago that produced rows like One Piece
 * "episode 801" in 2026 (docs/AUDIT_2026-09-11.md, finding 5). The deriver is
 * fixed; this removes the rows it already wrote.
 *
 * Scope is deliberately narrow: only BROADCAST rows the slot-deriver made
 * (sourceProvider "jikan", no provider schedule id). Rows synced from a
 * provider's own airing schedule carry an externalScheduleId and are never
 * considered. A row is removed only when canonical episode data does not
 * support its episode number (isScheduledEpisodeSupported). A row any user
 * has set a reminder on is reported and left in place — reminders are user
 * data and deleting the row would cascade to them.
 */

import { prisma } from '../src/lib/prisma';
import { isScheduledEpisodeSupported } from '../src/lib/engine/schedule/scheduleEngine';

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`repair_schedule_fabrications — ${APPLY ? 'APPLY' : 'DRY RUN (pass --apply to write)'}\n`);

  const rows = await prisma.airingSchedule.findMany({
    where: { releaseType: 'BROADCAST', sourceProvider: 'jikan', externalScheduleId: null },
    include: {
      anime: { select: { canonicalTitle: true, airedFrom: true } },
      _count: { select: { reminders: true } },
    },
  });

  const summary = { kept: 0, removed: 0, keptBecauseReminders: 0 };

  for (const row of rows) {
    const label = `${row.anime.canonicalTitle} ep ${row.episode} @ ${row.airingAt.toISOString()}`;
    const supported = await isScheduledEpisodeSupported(row.animeId, row.episode, row.airingAt, row.anime.airedFrom);

    if (supported) {
      summary.kept++;
      console.log(`keep    ${label}`);
      continue;
    }
    if (row._count.reminders > 0) {
      summary.keptBecauseReminders++;
      console.log(`REVIEW  ${label} — unsupported episode number, but ${row._count.reminders} user reminder(s) attached; not removed`);
      continue;
    }

    summary.removed++;
    console.log(`remove  ${label} — episode number not supported by recorded episodes`);
    if (APPLY) await prisma.airingSchedule.delete({ where: { id: row.id } });
  }

  console.log('\nSummary:', summary);
  if (!APPLY) console.log('Dry run — nothing was written.');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
