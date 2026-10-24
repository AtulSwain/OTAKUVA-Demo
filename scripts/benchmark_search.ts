/**
 * OTAKUVA — benchmarks anime-title search latency before (plain
 * `contains`/ILIKE, the old implementation) vs after (Postgres full-text
 * + pg_trgm, src/lib/fuzzySearch.ts) at a representative catalog size.
 *
 * Usage: npx tsx scripts/benchmark_search.ts [--rows=30000]
 *
 * Builds its own throwaway Postgres database (same pattern as
 * tests/helpers/setupTestDb.ts — never touches the real `otakuva`
 * database or a `npm test` database), pushes the schema, applies
 * prisma/migrations/20260916120000_add_search_fts_trgm, bulk-seeds a
 * synthetic catalog server-side (SQL generate_series — seeding 30k rows
 * via individual Prisma creates would itself take longer than the
 * benchmark), runs both query shapes against a mix of exact, typo, and
 * miss queries, and prints latency + EXPLAIN ANALYZE. Drops the database
 * on exit, including on Ctrl+C/failure.
 */
import { Client } from 'pg';
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { resolveAdminDatabaseUrl } from '../tests/helpers/adminDatabaseUrl';

const repoRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(repoRoot, 'prisma', 'schema.prisma');
const searchMigrationSql = path.join(
  repoRoot,
  'prisma',
  'migrations',
  '20260916120000_add_search_fts_trgm',
  'migration.sql'
);
const prismaCli = require.resolve('prisma/build/index.js', { paths: [repoRoot] });

const ADMIN_DATABASE_URL = resolveAdminDatabaseUrl();

const rowsArg = process.argv.find((a) => a.startsWith('--rows='));
const ANIME_ROWS = rowsArg ? parseInt(rowsArg.split('=')[1], 10) : 30_000;

const dbName = `otakuva_benchmark_${crypto.randomBytes(6).toString('hex')}`;
if (!/^otakuva_benchmark_[a-f0-9]{12}$/.test(dbName)) {
  throw new Error('Refusing to run against an unexpected database name.');
}

const dbUrl = new URL(ADMIN_DATABASE_URL);
dbUrl.pathname = `/${dbName}`;
const databaseUrl = dbUrl.toString();

async function createDb() {
  const admin = new Client({ connectionString: ADMIN_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();
}

async function dropDb() {
  const admin = new Client({ connectionString: ADMIN_DATABASE_URL });
  await admin.connect();
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid != pg_backend_pid()`, [dbName]);
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
}

function pushSchema() {
  execFileSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--schema', schemaPath], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
  execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--url', databaseUrl, '--file', searchMigrationSql], {
    env: process.env,
    stdio: 'pipe',
  });
}

// A handful of real, findable titles seeded among the synthetic noise —
// what the benchmark actually searches for. Realistic queries: exact,
// lowercase-only (the old case-sensitivity bug), and a plausible typo.
const NEEDLES = [
  { title: "Frieren: Beyond Journey's End", queries: ["Frieren: Beyond Journey's End", 'frieren beyond journey', 'freiren beyond journey'] },
  { title: 'Fullmetal Alchemist: Brotherhood', queries: ['Fullmetal Alchemist: Brotherhood', 'fullmetal alchemist', 'fullmetal alchemest'] },
  { title: 'Attack on Titan', queries: ['Attack on Titan', 'attack on titan', 'atatck on titan'] },
  { title: 'Steins;Gate', queries: ['Steins;Gate', 'steins gate', 'steins gat'] },
  { title: 'Jujutsu Kaisen', queries: ['Jujutsu Kaisen', 'jujutsu kaisen', 'jujustu kaisen'] },
];

async function seed(client: Client) {
  // Bulk-generate a synthetic catalog server-side — an order of
  // magnitude faster than round-tripping ANIME_ROWS individual INSERTs
  // from Node, and this script cares about search latency at scale, not
  // seed realism beyond "enough distinct trigram/token content that an
  // index actually has work to do."
  await client.query(`
    INSERT INTO "Anime" (id, "externalSource", slug, "canonicalTitle", synopsis, "posterUrl", status, "updatedAt")
    SELECT
      'bench_anime_' || i,
      'benchmark',
      'benchmark-anime-' || i,
      (ARRAY['Sword','Shadow','Crimson','Silver','Eternal','Hidden','Broken','Sacred','Iron','Lunar'])[1 + (i % 10)] || ' ' ||
      (ARRAY['Academy','Chronicles','Kingdom','Requiem','Odyssey','Legacy','Rebellion','Reverie','Frontier','Nocturne'])[1 + ((i / 10) % 10)] || ' ' ||
      (ARRAY['Season 1','Season 2','Part 1','Part 2','', '', '', '', '', ''])[1 + (i % 10)],
      'Synthetic benchmark synopsis text for row ' || i || '.',
      '',
      CASE WHEN i % 500 = 0 THEN 'MERGED' ELSE 'Finished' END,
      now()
    FROM generate_series(1, $1) AS i
  `, [ANIME_ROWS]);

  await client.query(`
    INSERT INTO "AnimeTitle" (id, "animeId", type, title, "searchableTitle")
    SELECT
      'bench_title_' || i,
      'bench_anime_' || i,
      'english',
      lower((ARRAY['sword','shadow','crimson','silver','eternal','hidden','broken','sacred','iron','lunar'])[1 + (i % 10)] || ' ' ||
      (ARRAY['academy','chronicles','kingdom','requiem','odyssey','legacy','rebellion','reverie','frontier','nocturne'])[1 + ((i / 10) % 10)]),
      lower((ARRAY['sword','shadow','crimson','silver','eternal','hidden','broken','sacred','iron','lunar'])[1 + (i % 10)] || ' ' ||
      (ARRAY['academy','chronicles','kingdom','requiem','odyssey','legacy','rebellion','reverie','frontier','nocturne'])[1 + ((i / 10) % 10)])
    FROM generate_series(1, $1) AS i
  `, [ANIME_ROWS]);

  for (let n = 0; n < NEEDLES.length; n++) {
    const id = `bench_needle_${n}`;
    await client.query(
      `INSERT INTO "Anime" (id, "externalSource", slug, "canonicalTitle", synopsis, "posterUrl", status, "updatedAt")
       VALUES ($1, 'benchmark', $2, $3, 'Findable benchmark title.', '', 'Finished', now())`,
      [id, `benchmark-needle-${n}`, NEEDLES[n].title]
    );
  }

  await client.query('ANALYZE "Anime"');
  await client.query('ANALYZE "AnimeTitle"');
}

// The exact query shape src/lib/engine/anime/animeCatalogEngine.ts used
// before this migration — a plain case-sensitive `contains`, reproduced
// here in raw SQL (LIKE, Postgres's equivalent) since the old code path
// no longer exists to call directly. This is the "before" baseline.
async function oldContainsQuery(client: Client, term: string) {
  const start = process.hrtime.bigint();
  const res = await client.query(
    `SELECT DISTINCT a.id
     FROM "Anime" a
     LEFT JOIN "AnimeTitle" at ON at."animeId" = a.id
     WHERE a.status != 'MERGED'
       AND (a."canonicalTitle" LIKE '%' || $1 || '%' OR at.title LIKE '%' || $1 || '%')
     LIMIT 50`,
    [term]
  );
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  return { elapsedMs, count: res.rowCount, found: res.rows.length > 0 };
}

// The new query — mirrors src/lib/fuzzySearch.ts's searchAnimeIdsByTitle
// exactly (word_similarity_threshold lowered the same way, same WHERE/
// rank shape) since that function opens its own Prisma-managed
// transaction against the app's own connection, not this benchmark's ad
// hoc `pg` client.
async function newFuzzyQuery(client: Client, term: string) {
  const start = process.hrtime.bigint();
  await client.query('BEGIN');
  await client.query('SET LOCAL pg_trgm.word_similarity_threshold = 0.3');
  const likePattern = `%${term}%`;
  // UNION ALL of two single-table-scoped subqueries, not one query with
  // `WHERE (a.col... OR at.col...)` across the join — see the long
  // comment on searchAnimeIdsByTitle in src/lib/fuzzySearch.ts for why
  // that distinction is the whole story of this benchmark: the join-OR
  // form silently defeats every trigram/tsvector index the migration
  // creates (confirmed via EXPLAIN ANALYZE), falling back to a full
  // sequential scan of both tables on every query regardless of index
  // presence. This mirrors fuzzySearch.ts's actual query exactly.
  const res = await client.query(
    `SELECT id, MAX(rank) AS rank FROM (
       SELECT a.id,
              (CASE WHEN lower(a."canonicalTitle") LIKE lower($2) THEN 2 ELSE 0 END)
                + word_similarity(lower($1), lower(a."canonicalTitle")) AS rank
       FROM "Anime" a
       WHERE a.status != 'MERGED'
         AND (
           lower(a."canonicalTitle") LIKE lower($2)
           OR lower($1) <% lower(a."canonicalTitle")
         )
       UNION ALL
       SELECT at."animeId" AS id,
              (CASE WHEN lower(at.title) LIKE lower($2) THEN 2 ELSE 0 END)
                + GREATEST(
                    word_similarity(lower($1), lower(at.title)),
                    COALESCE(ts_rank(at."searchVector", plainto_tsquery('simple', $1)), 0)
                  ) AS rank
       FROM "AnimeTitle" at
       JOIN "Anime" a2 ON a2.id = at."animeId" AND a2.status != 'MERGED'
       WHERE (
         lower(at.title) LIKE lower($2)
         OR lower($1) <% lower(at.title)
         OR at."searchVector" @@ plainto_tsquery('simple', $1)
       )
     ) matches
     GROUP BY id
     ORDER BY rank DESC
     LIMIT 50`,
    [term, likePattern]
  );
  await client.query('COMMIT');
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  return { elapsedMs, count: res.rowCount, found: res.rows.length > 0 };
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return { avg, p50, p95, min: sorted[0], max: sorted[sorted.length - 1] };
}

async function main() {
  console.log(`Creating throwaway database ${dbName} (${ANIME_ROWS} synthetic anime rows)...`);
  await createDb();
  let client: Client | null = null;
  try {
    pushSchema();
    client = new Client({ connectionString: databaseUrl });
    // dropDb() below forcibly terminates every backend connected to this
    // database (including this one, if it's still open) so DROP DATABASE
    // can proceed — that termination arrives as an async 'error' event on
    // this client. Expected and harmless as long as we've already
    // finished with it (see the explicit client.end() before dropDb() in
    // the finally block below); without this listener Node treats an
    // unhandled 'error' event as fatal and crashes the process anyway.
    client.on('error', () => {});
    await client.connect();

    console.log('Seeding...');
    const seedStart = Date.now();
    await seed(client);
    console.log(`Seeded in ${Date.now() - seedStart}ms.`);

    const allQueries = NEEDLES.flatMap((n) => n.queries);
    const RUNS_PER_QUERY = 20;

    const oldSamples: number[] = [];
    const newSamples: number[] = [];
    let oldHits = 0;
    let newHits = 0;

    for (const term of allQueries) {
      for (let i = 0; i < RUNS_PER_QUERY; i++) {
        const oldResult = await oldContainsQuery(client, term);
        oldSamples.push(oldResult.elapsedMs);
        if (oldResult.found) oldHits++;

        const newResult = await newFuzzyQuery(client, term);
        newSamples.push(newResult.elapsedMs);
        if (newResult.found) newHits++;
      }
    }

    const oldStats = stats(oldSamples);
    const newStats = stats(newSamples);
    const totalRuns = allQueries.length * RUNS_PER_QUERY;

    console.log('\n=== Results ===');
    console.log(`Catalog size: ${ANIME_ROWS.toLocaleString()} anime, ${ANIME_ROWS.toLocaleString()} AnimeTitle rows, plus ${NEEDLES.length} known-findable titles`);
    console.log(`Queries: ${allQueries.length} distinct (exact / lowercase / typo variants of ${NEEDLES.length} real titles), ${RUNS_PER_QUERY} runs each = ${totalRuns} total runs per implementation\n`);

    console.log('OLD (contains/LIKE, case-sensitive, no typo tolerance):');
    console.log(`  found a result: ${oldHits}/${totalRuns} runs`);
    console.log(`  avg ${oldStats.avg.toFixed(2)}ms  p50 ${oldStats.p50.toFixed(2)}ms  p95 ${oldStats.p95.toFixed(2)}ms  min ${oldStats.min.toFixed(2)}ms  max ${oldStats.max.toFixed(2)}ms\n`);

    console.log('NEW (full-text + pg_trgm, case-insensitive, typo-tolerant):');
    console.log(`  found a result: ${newHits}/${totalRuns} runs`);
    console.log(`  avg ${newStats.avg.toFixed(2)}ms  p50 ${newStats.p50.toFixed(2)}ms  p95 ${newStats.p95.toFixed(2)}ms  min ${newStats.min.toFixed(2)}ms  max ${newStats.max.toFixed(2)}ms\n`);

    console.log(`Recall improvement: ${oldHits}/${totalRuns} -> ${newHits}/${totalRuns} (the difference is entirely lowercase/typo queries the old implementation could never match, by construction)`);
    console.log(`Latency delta: ${(newStats.avg - oldStats.avg).toFixed(2)}ms avg (${newStats.avg > oldStats.avg ? '+' : ''}${(((newStats.avg - oldStats.avg) / oldStats.avg) * 100).toFixed(0)}%)`);

    console.log('\n=== EXPLAIN ANALYZE: new query, exact-match term ===');
    await client.query('BEGIN');
    await client.query('SET LOCAL pg_trgm.word_similarity_threshold = 0.3');
    const plan = await client.query(
      `EXPLAIN ANALYZE
       SELECT id FROM (
         SELECT a.id
         FROM "Anime" a
         WHERE a.status != 'MERGED'
           AND (lower(a."canonicalTitle") LIKE lower($2) OR lower($1) <% lower(a."canonicalTitle"))
         UNION ALL
         SELECT at."animeId" AS id
         FROM "AnimeTitle" at
         JOIN "Anime" a2 ON a2.id = at."animeId" AND a2.status != 'MERGED'
         WHERE (lower(at.title) LIKE lower($2) OR lower($1) <% lower(at.title) OR at."searchVector" @@ plainto_tsquery('simple', $1))
       ) matches
       GROUP BY id
       LIMIT 50`,
      ['Fullmetal Alchemist: Brotherhood', '%Fullmetal Alchemist: Brotherhood%']
    );
    await client.query('COMMIT');
    console.log(plan.rows.map((r) => r['QUERY PLAN']).join('\n'));

  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        // already closed / connection lost — fine, we're dropping the
        // whole database next anyway
      }
    }
    console.log(`\nDropping ${dbName}...`);
    await dropDb();
  }
}

main().catch(async (err) => {
  console.error('Benchmark failed:', err);
  try {
    await dropDb();
  } catch {
    // best-effort cleanup
  }
  process.exit(1);
});
