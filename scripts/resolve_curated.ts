/**
 * OTAKUVA — RESOLVE CURATED LISTS (Otakuva Choice + Award Winners)
 * Usage: npx tsx scripts/resolve_curated.ts
 *
 * For each entry in src/lib/curated.ts: look it up in the catalog; if it is
 * missing, search the provider (with the usual failover), pick the result whose
 * title (and format/year, when given) matches, and ingest it through
 * SyncEngine.ingestAnime like any other import. Adult titles are never
 * imported. Prints what resolved, what was imported and what still could not
 * be found so the entry can be corrected in curated.ts.
 */

import { prisma } from '../src/lib/prisma';
import { defaultAnimeProvider } from '../src/lib/providers';
import { syncEngine } from '../src/lib/syncEngine';
import { findCuratedAnime } from '../src/lib/browseService';
import { AWARDS, OTAKUVA_CHOICE, CuratedEntry } from '../src/lib/curated';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function importFromProvider(entry: CuratedEntry): Promise<boolean> {
  const want = norm(entry.search);
  const res = await defaultAnimeProvider.searchAnime(entry.search, 1, 15);
  const candidates = res.items
    .filter((p) => !p.isAdult)
    .filter((p) => !entry.format || p.type.toLowerCase() === entry.format.toLowerCase())
    .filter((p) => !entry.year || p.year === entry.year)
    .filter((p) => [p.title, ...p.titles.map((t) => t.title)].map(norm).some((n) => n === want || n.includes(want)))
    .sort((a, b) => a.title.length - b.title.length);
  if (candidates.length === 0) return false;
  const pick = candidates[0];
  await syncEngine.ingestAnime(pick, pick.externalSource === 'mal' ? 'jikan' : 'anilist');
  console.log(`   imported "${pick.title}" (${pick.externalSource}:${pick.externalId})`);
  return true;
}

async function main() {
  const entries: Array<{ list: string; entry: CuratedEntry }> = [
    ...OTAKUVA_CHOICE.map((entry) => ({ list: 'choice', entry })),
    ...AWARDS.map((entry) => ({ list: 'awards', entry })),
  ];
  const unresolved: string[] = [];
  for (const { list, entry } of entries) {
    let anime = await findCuratedAnime(entry);
    if (!anime) {
      console.log(`[${list}] "${entry.search}" not in catalog — searching provider...`);
      try {
        if (await importFromProvider(entry)) anime = await findCuratedAnime(entry);
      } catch (err: any) {
        console.warn(`   provider search failed: ${err?.message || err}`);
      }
    }
    if (anime) console.log(`[${list}] "${entry.search}" -> ${anime.canonicalTitle} (${anime.year ?? '?'}, ${anime.type})`);
    else {
      unresolved.push(`[${list}] ${entry.search}`);
      console.warn(`[${list}] "${entry.search}" NOT RESOLVED`);
    }
  }
  console.log(unresolved.length ? `\nUnresolved (${unresolved.length}):\n${unresolved.join('\n')}` : '\nAll entries resolved.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[resolve_curated] Failed:', err);
  process.exit(1);
});
