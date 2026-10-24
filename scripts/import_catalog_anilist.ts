/**
 * OTAKUVA — GROW THE CATALOG FROM ANILIST (new titles only)
 * Usage:
 *   npx tsx scripts/import_catalog_anilist.ts                 # dry run: report only
 *   npx tsx scripts/import_catalog_anilist.ts --apply         # write
 *   options: --max-new=500  --pages=20  --genre-pages=3  --decade-pages=2
 *
 *   npx tsx scripts/import_catalog_anilist.ts --all --apply  # the WHOLE catalog
 *   options: --from-year=1917 --to-year=<next year>  (--max-new defaults to no cap)
 *     Walks every start year in id order (each title is listed exactly once,
 *     including year-only dates), then every not-yet-released title (many
 *     have no date). Re-runnable: anything already imported is skipped, so an
 *     interrupted run just continues. Same rules as below.
 *
 * Sources (AniList, most popular first, non-adult only, no music videos):
 *   1. overall popularity, `--pages` pages of 50
 *   2. every Browse genre (src/lib/browse.ts), `--genre-pages` pages each —
 *      so thin genres (Thriller, Music, Horror…) fill out, not just Action
 *   3. each decade 1970s–2000s, `--decade-pages` pages each
 *
 * No title is added twice:
 *   - anything whose AniList or MAL id is already in the catalog is skipped
 *     (existing rows are left untouched — this only adds, it never rewrites
 *     data another provider owns);
 *   - a title whose normalized name + format + year matches an existing row
 *     under different ids is skipped and listed for review, not guessed at;
 *   - repeats across sources/pages in one run are counted once;
 *   - the rest go through SyncEngine.ingestAnime, which resolves by provider
 *     ids first and never lets a same-title slug overwrite a different show.
 * Genres, themes, AniList tags, studios, titles and provenance come with each
 * title via ingestAnime. Run scripts/audit_catalog_duplicates.ts afterwards.
 */
import { prisma } from '../src/lib/prisma';
import { anilistProvider } from '../src/lib/providers/anilistProvider';
import { syncEngine } from '../src/lib/syncEngine';
import { BROWSE_GENRES } from '../src/lib/browse';
import type { ProviderAnime } from '../src/lib/providers/animeProvider.interface';

const arg = (name: string, fallback: number) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const n = hit ? parseInt(hit.split('=')[1], 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
const MAX_NEW = arg('max-new', ALL ? Number.MAX_SAFE_INTEGER : 500);
const FROM_YEAR = arg('from-year', 1917);
const TO_YEAR = arg('to-year', new Date().getUTCFullYear() + 1);
const PAGES = arg('pages', 20);
const GENRE_PAGES = arg('genre-pages', 3);
const DECADE_PAGES = arg('decade-pages', 2);
const DECADES = [1970, 1980, 1990, 2000];

const normTitle = (t: string) =>
  t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const titleKey = (title: string, type: string | null | undefined, year: number | null | undefined) =>
  `${normTitle(title)}|${type ?? ''}|${year ?? ''}`;

function isExcluded(a: ProviderAnime): string | null {
  const genres = (a.genres || []).map((g) => g.toLowerCase());
  if (a.isAdult || genres.includes('hentai') || genres.includes('erotica')) return 'adult';
  if (a.type === 'Music') return 'music video';
  return null;
}

async function main() {
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — max new ${MAX_NEW}, pages ${PAGES}, genre pages ${GENRE_PAGES}, decade pages ${DECADE_PAGES}`);

  const existing = await prisma.anime.findMany({
    select: { slug: true, canonicalTitle: true, malId: true, anilistId: true, type: true, year: true, startYear: true },
  });
  const malIds = new Set(existing.map((r) => r.malId).filter((x): x is number => x != null));
  const anilistIds = new Set(existing.map((r) => r.anilistId).filter((x): x is number => x != null));
  const titleIndex = new Map(existing.map((r) => [titleKey(r.canonicalTitle, r.type, r.year ?? r.startYear), r.slug]));
  const before = existing.length;

  const seen = new Set<string>();
  const stats = { fetched: 0, alreadyInCatalog: 0, repeatInRun: 0, excluded: 0, reviewNeeded: 0, added: 0, failed: 0 };
  const review: string[] = [];
  const addedTitles: string[] = [];
  const byGenre = new Map<string, number>();
  const failedSources: string[] = [];

  const consider = async (a: ProviderAnime) => {
    stats.fetched++;
    if (seen.has(a.externalId)) { stats.repeatInRun++; return; }
    seen.add(a.externalId);
    if ((a.anilistId && anilistIds.has(a.anilistId)) || (a.malId && malIds.has(a.malId))) { stats.alreadyInCatalog++; return; }
    if (isExcluded(a)) { stats.excluded++; return; }
    const year = a.startDate?.year ?? a.year ?? null;
    const sameTitle = titleIndex.get(titleKey(a.title, a.type, year));
    if (sameTitle) {
      stats.reviewNeeded++;
      review.push(`${a.title} (${a.type} ${year ?? '?'}, anilist ${a.anilistId}, mal ${a.malId ?? '-'}) ~ existing /anime/${sameTitle}`);
      return;
    }
    if (stats.added >= MAX_NEW) return;

    if (APPLY) {
      try {
        const res = await syncEngine.ingestAnime(a, 'anilist');
        if (!res.isNew) { stats.alreadyInCatalog++; return; }
      } catch (err: any) {
        stats.failed++;
        console.warn(`  ! could not import ${a.title}: ${err?.message || err}`);
        return;
      }
    }
    stats.added++;
    addedTitles.push(`${a.title} (${a.type} ${year ?? '?'})`);
    for (const g of a.genres || []) byGenre.set(g, (byGenre.get(g) || 0) + 1);
    if (a.anilistId) anilistIds.add(a.anilistId);
    if (a.malId) malIds.add(a.malId);
    titleIndex.set(titleKey(a.title, a.type, year), '(added this run)');
  };

  const run = async (label: string, pages: number, fetchPage: (p: number) => Promise<{ items: ProviderAnime[]; pagination: { hasNextPage: boolean } }>) => {
    for (let p = 1; p <= pages && stats.added < MAX_NEW; p++) {
      let res;
      // A full-catalog walk retries a failed page a few times (AniList 429s /
      // 5xx come and go) instead of silently dropping the rest of a year.
      for (let attempt = 1; ; attempt++) {
        try {
          res = await fetchPage(p);
          break;
        } catch (err: any) {
          if (!ALL || attempt >= 4) {
            console.warn(`  ! ${label} page ${p} failed: ${err?.message || err} — stopping this source`);
            failedSources.push(`${label} p${p}`);
            return;
          }
          console.warn(`  ! ${label} page ${p} failed (attempt ${attempt}): ${err?.message || err} — retrying in ${attempt * 20}s`);
          await new Promise((r) => setTimeout(r, attempt * 20000));
        }
      }
      for (const a of res.items) await consider(a);
      process.stdout.write(`  ${label} p${p}: ${res.items.length} fetched, ${stats.added} new so far\n`);
      if (!res.pagination.hasNextPage) return;
    }
  };

  if (ALL) {
    // Newest years first, so the titles people look for land early.
    for (let y = TO_YEAR; y >= FROM_YEAR; y--) await run(`${y}`, 10000, (p) => anilistProvider.getAnimeByStartYear(y, p, 50));
    await run('Not yet released', 10000, (p) => anilistProvider.getUnreleasedAnime(p, 50));
  } else {
    await run('Popular', PAGES, (p) => anilistProvider.getAnimeList(p, 50));
    for (const g of BROWSE_GENRES) await run(`Genre ${g}`, GENRE_PAGES, (p) => anilistProvider.getAnimeByGenre(g, p, 50));
    for (const d of DECADES) await run(`${d}s`, DECADE_PAGES, (p) => anilistProvider.getHistoricalAnime(d, d + 9, p, 50));
  }

  console.log('\n== Summary ==');
  console.log(`Fetched from AniList:        ${stats.fetched}`);
  console.log(`Already in catalog (skipped): ${stats.alreadyInCatalog}`);
  console.log(`Repeated across lists:       ${stats.repeatInRun}`);
  console.log(`Adult / music (skipped):     ${stats.excluded}`);
  console.log(`Same title, other ids:       ${stats.reviewNeeded} (skipped, listed below for review)`);
  console.log(`${APPLY ? 'Added' : 'Would add'}:                   ${stats.added}`);
  if (stats.failed) console.log(`Failed:                      ${stats.failed}`);
  if (failedSources.length) console.log(`Pages that kept failing (re-run to pick them up): ${failedSources.join(', ')}`);
  console.log(`New titles by genre: ${[...byGenre.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(', ')}`);
  if (review.length) {
    console.log('\nNeeds review (not imported):');
    for (const r of review) console.log(`  - ${r}`);
  }
  console.log(`\nFirst ${Math.min(25, addedTitles.length)} ${APPLY ? 'added' : 'to add'}:`);
  for (const t of addedTitles.slice(0, 25)) console.log(`  + ${t}`);
  if (APPLY) console.log(`\nCatalog: ${before} → ${await prisma.anime.count()}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
