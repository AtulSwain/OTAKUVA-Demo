/**
 * Reconcile an anime's release facts against the raw provider payload we
 * already stored for it (DataSourceRecord, layer 1) — no network calls, no
 * guessing.
 *
 * Why: some season records carry series-level values (e.g. `attack-on-titan`,
 * Season 1, showed year 2023 / 87 episodes while its own stored Jikan payload
 * says 2013 / 25). This rewrites only fields the payload actually states.
 *
 * Safety:
 *   - dry run by default; pass --apply to write
 *   - only uses a payload whose mal_id matches the record's malId
 *   - never touches a field with an EditorialOverride (editorial wins)
 *   - every change is logged to AnimeMetadataHistory (source
 *     "payload-reconcile") with old and new values
 *   - fields: year, startYear, season, seasonYear, episodes, startDate, endDate
 *
 * Usage:
 *   npx tsx scripts/reconcile_anime_from_payload.ts --slug attack-on-titan
 *   npx tsx scripts/reconcile_anime_from_payload.ts --slug attack-on-titan --apply
 *   npx tsx scripts/reconcile_anime_from_payload.ts --all            (scan; dry run)
 */
import { prisma } from '../src/lib/prisma';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const all = args.includes('--all');
const slugIdx = args.indexOf('--slug');
const slug = slugIdx >= 0 ? args[slugIdx + 1] : null;

type Field = 'year' | 'startYear' | 'season' | 'seasonYear' | 'episodes' | 'startDate' | 'endDate';

function fromJikanPayload(p: any): Partial<Record<Field, unknown>> {
  const out: Partial<Record<Field, unknown>> = {};
  const from = p?.aired?.from ? new Date(p.aired.from) : null;
  const to = p?.aired?.to ? new Date(p.aired.to) : null;
  const year = typeof p?.year === 'number' ? p.year : from && !isNaN(+from) ? from.getUTCFullYear() : null;
  if (year) {
    out.year = year;
    out.startYear = year;
  }
  if (typeof p?.season === 'string' && p.season) {
    out.season = p.season.charAt(0).toUpperCase() + p.season.slice(1).toLowerCase();
    if (year) out.seasonYear = year;
  }
  if (typeof p?.episodes === 'number' && p.episodes > 0) out.episodes = p.episodes;
  if (from && !isNaN(+from)) out.startDate = from;
  if (to && !isNaN(+to)) out.endDate = to;
  return out;
}

// Dates are compared by calendar day: some imports stored date-only values at
// 05:30 UTC (an IST midnight), which is the same day — not worth rewriting.
const day = (v: unknown) => (v ? new Date(v as any).toISOString().slice(0, 10) : null);
const same = (a: unknown, b: unknown) => (a instanceof Date || b instanceof Date ? day(a) === day(b) : a === b);

async function reconcile(anime: any): Promise<number> {
  if (!anime.malId) return 0;
  const records = await prisma.dataSourceRecord.findMany({
    where: { entityType: 'ANIME', entityId: anime.id, provider: 'jikan' } as any,
  });
  const record = (records as any[]).find((r) => {
    try {
      return JSON.parse(r.payload)?.mal_id === anime.malId;
    } catch {
      return false;
    }
  });
  if (!record) return 0;

  const wanted = fromJikanPayload(JSON.parse(record.payload));
  const overrides = await prisma.editorialOverride.findMany({ where: { entityType: 'ANIME', entityId: anime.id }, select: { field: true } });
  const locked = new Set(overrides.map((o) => o.field));

  const changes: { field: Field; from: unknown; to: unknown }[] = [];
  for (const [field, value] of Object.entries(wanted) as [Field, unknown][]) {
    if (locked.has(field)) continue;
    if (!same(anime[field], value)) changes.push({ field, from: anime[field], to: value });
  }
  if (changes.length === 0) return 0;

  console.log(`\n${anime.slug} (MAL ${anime.malId})`);
  for (const c of changes) console.log(`  ${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);

  if (apply) {
    await prisma.$transaction([
      prisma.anime.update({ where: { id: anime.id }, data: Object.fromEntries(changes.map((c) => [c.field, c.to])) }),
      prisma.animeMetadataHistory.createMany({
        data: changes.map((c) => ({
          animeId: anime.id,
          field: c.field,
          oldValue: c.from == null ? null : c.from instanceof Date ? c.from.toISOString() : String(c.from),
          newValue: c.to == null ? null : c.to instanceof Date ? (c.to as Date).toISOString() : String(c.to),
          source: 'payload-reconcile',
        })),
      }),
    ]);
  }
  return changes.length;
}

async function main() {
  if (!slug && !all) {
    console.error('Pass --slug <slug> or --all.');
    process.exit(2);
  }
  const select = { id: true, slug: true, malId: true, year: true, startYear: true, season: true, seasonYear: true, episodes: true, startDate: true, endDate: true };
  const animes = slug
    ? await prisma.anime.findMany({ where: { slug }, select })
    : await prisma.anime.findMany({ where: { malId: { not: null }, status: { not: 'MERGED' } }, select });

  let touched = 0;
  let fields = 0;
  for (const a of animes) {
    const n = await reconcile(a);
    if (n) {
      touched++;
      fields += n;
    }
  }
  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${fields} field change(s) across ${touched} anime (scanned ${animes.length}).`);
  if (!apply && fields > 0) console.log('Re-run with --apply to write.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
