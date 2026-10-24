/**
 * OTAKUVA — LATEST-EPISODE-ONLY FETCH (for the weekly broadcast schedule)
 *
 * `refresh_airing_episodes.ts` walks a show's *entire* episode history
 * page by page, which is exactly right for building a complete catalog —
 * but under Jikan's current heavy rate-limiting, a several-hundred-page
 * walk for a show like One Piece or Case Closed keeps failing partway
 * through, well before it ever reaches today's episodes (see that
 * script's own results: still thousands of days stale after two full
 * attempts).
 *
 * The weekly-slot schedule (`ScheduleEngine.syncFromBroadcastMetadata`)
 * doesn't need the full history, though — it only needs the *latest*
 * episode's number and air date to be trustworthy. Jikan's `/episodes`
 * response includes `last_visible_page` on page 1, so this fetches just
 * two pages per anime — page 1 (to learn the page count) and the actual
 * last page — instead of walking every page in between. That's a ~95%+
 * reduction in requests for a long runner, which should get through even
 * while Jikan is degraded.
 *
 * Only touches anime that could ever appear on the weekly schedule
 * (status "Currently Airing" with a recorded broadcastDay/broadcastTime).
 * Never fabricates an episode; if a fetch fails, that title is simply
 * left as before.
 *
 * Usage: npx tsx scripts/fetch_latest_episodes.ts
 */

import { prisma } from '../src/lib/prisma';
import { jikanProvider } from '../src/lib/providers/jikanProvider';
import { validateAndNormalizeEpisode } from '../src/lib/normalizers';
import { ScheduleEngine } from '../src/lib/engine/schedule/scheduleEngine';

async function main() {
  const airing = await prisma.anime.findMany({
    where: { status: 'Currently Airing', malId: { not: null }, broadcastDay: { not: null }, broadcastTime: { not: null } },
    select: { id: true, canonicalTitle: true, malId: true },
    orderBy: { canonicalTitle: 'asc' },
  });

  console.log(`[latest-ep] ${airing.length} currently-airing, broadcast-scheduled anime to check.\n`);

  let updated = 0;
  let noChange = 0;
  let failed = 0;

  for (const anime of airing) {
    try {
      const first = await jikanProvider.getAnimeEpisodes(String(anime.malId), 1);
      const lastPage = first.pagination.lastVisiblePage || 1;
      const target = lastPage > 1 ? await jikanProvider.getAnimeEpisodes(String(anime.malId), lastPage) : first;

      if (!target.episodes.length) {
        noChange++;
        console.log(`[latest-ep] ${anime.canonicalTitle} (mal:${anime.malId}) — no episodes on last page (${lastPage}), left as-is`);
        continue;
      }

      let count = 0;
      for (const ep of target.episodes) {
        const norm = validateAndNormalizeEpisode(ep, anime.id);
        await prisma.episode.upsert({
          where: { animeId_number: { animeId: anime.id, number: norm.number } },
          update: {
            title: norm.title,
            titleJapanese: norm.titleJapanese,
            synopsis: norm.synopsis,
            airedAt: norm.airedAt,
            filler: norm.filler,
            recap: norm.recap,
            externalUrl: norm.externalUrl,
            imageUrl: norm.imageUrl,
            updatedAt: new Date(),
          },
          create: {
            animeId: anime.id,
            externalId: norm.externalId,
            number: norm.number,
            title: norm.title,
            titleJapanese: norm.titleJapanese,
            synopsis: norm.synopsis,
            airedAt: norm.airedAt,
            filler: norm.filler,
            recap: norm.recap,
            externalUrl: norm.externalUrl,
            imageUrl: norm.imageUrl,
          },
        });
        count++;
      }
      updated++;
      const maxNum = Math.max(...target.episodes.map((e) => e.number));
      console.log(`[latest-ep] ${anime.canonicalTitle} (mal:${anime.malId}) — page ${lastPage}/${lastPage}, ${count} episodes upserted, highest #${maxNum}`);
    } catch (err: any) {
      failed++;
      console.warn(`[latest-ep] FAILED for ${anime.canonicalTitle} (mal:${anime.malId}): ${err?.message || err}`);
    }
  }

  console.log(`\n[latest-ep] ${updated} updated, ${noChange} unchanged, ${failed} failed.`);

  console.log('\n[latest-ep] Re-running broadcast-metadata schedule sync...');
  const scheduleRes = await ScheduleEngine.syncFromBroadcastMetadata();
  console.log('[latest-ep] Schedule sync result:', scheduleRes);
}

main()
  .catch((error) => {
    console.error('[latest-ep] Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
