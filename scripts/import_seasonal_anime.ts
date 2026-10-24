/**
 * OTAKUVA — IMPORT CURRENT + NEXT SEASON (AND UPCOMING) ANIME
 * Usage: npx tsx scripts/import_seasonal_anime.ts [pages=3]
 *
 * News covers new and upcoming shows the catalog may not have yet, which is why
 * few articles link to an anime. This pulls the current season, the next season
 * and the upcoming list from the provider (with the usual failover) and ingests
 * them through SyncEngine.ingestAnime — so provenance, external ids and the
 * editorial-override rules all apply exactly as for any other import. Titles
 * come from the provider only; nothing is invented. Then it re-runs the news
 * sync, which re-matches the articles still in each feed against the enlarged
 * catalog (existing links are left alone; only new ones are added).
 */

import { prisma } from '../src/lib/prisma';
import { defaultAnimeProvider } from '../src/lib/providers';
import { syncEngine } from '../src/lib/syncEngine';
import { newsEngine } from '../src/lib/engine/news/newsEngine';

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const;

function seasonOffset(now: Date, offset: number) {
  const idx = Math.floor(now.getUTCMonth() / 3) + offset;
  return { year: now.getUTCFullYear() + Math.floor(idx / 4), season: SEASONS[idx % 4] };
}

async function main() {
  const pages = parseInt(process.argv[2] || '3', 10);
  const now = new Date();
  const targets = [seasonOffset(now, 0), seasonOffset(now, 1)];
  const before = await prisma.anime.count();
  const seen = new Set<string>();
  let ingested = 0;
  let failed = 0;
  let skippedAdult = 0;

  const ingestAll = async (label: string, items: any[]) => {
    for (const item of items) {
      const key = `${item.externalSource}:${item.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // The public site has no adult-content gate, so adult titles are never
      // imported here (providers return them in seasonal/upcoming lists).
      const genres: string[] = (item.genres || []).map((g: any) => String(typeof g === 'string' ? g : g?.name || '').toLowerCase());
      if (item.isAdult || genres.includes('hentai') || genres.includes('erotica')) {
        skippedAdult++;
        continue;
      }
      try {
        await syncEngine.ingestAnime(item, item.externalSource === 'mal' ? 'jikan' : 'anilist');
        ingested++;
      } catch (err: any) {
        failed++;
        console.warn(`  ! ${label}: could not ingest ${item.title || key}: ${err?.message || err}`);
      }
    }
  };

  for (const { year, season } of targets) {
    for (let page = 1; page <= pages; page++) {
      const res = await defaultAnimeProvider.getSeasonalAnime(year, season, page, 50);
      console.log(`${season} ${year} p${page}: ${res.items.length} titles`);
      await ingestAll(`${season} ${year}`, res.items);
      if (!res.pagination?.hasNextPage) break;
    }
  }
  for (let page = 1; page <= pages; page++) {
    const res = await defaultAnimeProvider.getUpcomingAnime(page, 50);
    console.log(`UPCOMING p${page}: ${res.items.length} titles`);
    await ingestAll('upcoming', res.items);
    if (!res.pagination?.hasNextPage) break;
  }

  const after = await prisma.anime.count();
  console.log(`Anime catalog: ${before} -> ${after} (ingested/updated ${ingested}, failed ${failed}, adult skipped ${skippedAdult})`);

  console.log('Re-matching news against the enlarged catalog...');
  const results = await newsEngine.syncAllProviders(60);
  const links = results.reduce((s: number, r: any) => s + (r?.entityMatchesCreated || 0), 0);
  console.log(`New article↔anime links created: ${links}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[import_seasonal_anime] Failed:', err);
  process.exit(1);
});
