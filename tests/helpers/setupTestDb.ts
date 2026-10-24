/**
 * Test database bootstrap — import this FIRST in every test file, before
 * anything that constructs a PrismaClient.
 *
 * Creates a brand-new, throwaway PostgreSQL database (via `CREATE
 * DATABASE`, through the admin connection at TEST_DATABASE_ADMIN_URL),
 * pushes the Prisma schema into it, and points DATABASE_URL there. Tests
 * therefore start from an empty schema, create only the rows they need,
 * and never read or write the real `otakuva` database. (The ad-hoc
 * src/lib/test_*.ts scripts wrote fixtures straight into the shared dev
 * database, which is how "Mind Paradox 1788674684858" ended up in the
 * catalog — see docs/production/RUNBOOK.md and CLAUDE.md's cleanup notes.)
 *
 * Was SQLite (a fresh `file:` DB per process, no server needed) before the
 * Postgres migration — see git history of this file for that version.
 * Needs the admin connection reachable — TEST_DATABASE_ADMIN_URL, else
 * DATABASE_URL with its database swapped for `postgres` (see
 * adminDatabaseUrl.ts; the same local Postgres `npm run dev` uses) — `npm test` fails fast with a clear connection
 * error if nothing is listening there, same as any other Postgres-backed
 * command in this repo now.
 *
 * Each test *file* gets its own database (node's test runner spawns one
 * process per file), named `otakuva_test_<12 hex chars>`; it's dropped at
 * process exit (best-effort — see pg-drop-db.cjs). A run that's killed
 * before exit-handlers fire leaves its database behind; sweep those up
 * with `npx tsx scripts/reset_test_dbs.ts`.
 */
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { resolveAdminDatabaseUrl } from './adminDatabaseUrl';

const repoRoot = path.resolve(__dirname, '..', '..');
const schemaPath = path.join(repoRoot, 'prisma', 'schema.prisma');
const prismaCli = require.resolve('prisma/build/index.js', { paths: [repoRoot] });

const ADMIN_DATABASE_URL = resolveAdminDatabaseUrl();

const dbName = `otakuva_test_${crypto.randomBytes(6).toString('hex')}`;

const testUrl = new URL(ADMIN_DATABASE_URL);
testUrl.pathname = `/${dbName}`;
const databaseUrl = testUrl.toString();

if (dbName === 'otakuva' || dbName === 'otakuva_test') {
  // Unreachable given the random suffix, but this is exactly the mistake
  // that must never silently happen — keep the guard explicit.
  throw new Error(`Refusing to run tests against a non-throwaway database name: ${dbName}`);
}

function runHelper(script: string) {
  execFileSync(process.execPath, [path.join(__dirname, script)], {
    env: { ...process.env, PG_ADMIN_URL: ADMIN_DATABASE_URL, PG_TARGET_DB: dbName },
    stdio: 'pipe',
  });
}

try {
  runHelper('pg-create-db.cjs');
} catch (err: any) {
  const stderr = err?.stderr?.toString?.() || err?.message || String(err);
  throw new Error(
    `Couldn't create throwaway test database "${dbName}" via TEST_DATABASE_ADMIN_URL ` +
      `(${ADMIN_DATABASE_URL.replace(/:[^:@]*@/, ':***@')}). Is Postgres running and reachable? ` +
      `Original error:\n${stderr}`
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.AUTH_SECRET = 'otakuva-test-only-secret-0123456789abcdef';
// Uploads go to the local provider inside a temp dir, never R2 or public/.
process.env.LOCAL_UPLOADS_ROOT = path.join(require('os').tmpdir(), `otakuva-test-uploads-${dbName}`);
process.env.STORAGE_PROVIDER = 'local';
delete process.env.GIPHY_API_KEY;
// Keep the dev-mode Prisma global cache and non-production auth behaviour.
(process.env as Record<string, string>).NODE_ENV = 'test';

execFileSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--schema', schemaPath], {
  env: process.env,
  stdio: 'pipe',
});

// `db push` builds the schema purely from prisma/schema.prisma's
// declared models — it never runs anything under prisma/migrations/, so
// objects that exist only as hand-written migration SQL (the pg_trgm
// extension, AnimeTitle's generated tsvector column, and the GIN
// trigram/full-text indexes — see prisma/migrations/
// 20260916120000_add_search_fts_trgm and src/lib/fuzzySearch.ts) would
// silently not exist in a test database without this. Reads that exact
// same migration file rather than duplicating its SQL, so there's one
// source of truth for both real deploys (`prisma migrate deploy`, which
// runs it in order alongside every other migration) and tests.
const searchMigrationSql = path.join(
  repoRoot,
  'prisma',
  'migrations',
  '20260916120000_add_search_fts_trgm',
  'migration.sql'
);
execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--url', databaseUrl, '--file', searchMigrationSql], {
  env: process.env,
  stdio: 'pipe',
});

process.on('exit', () => {
  try {
    runHelper('pg-drop-db.cjs');
  } catch {
    // best-effort — see this file's header on scripts/reset_test_dbs.ts
  }
});

export const TEST_DATABASE_URL = databaseUrl;
export const TEST_DB_NAME = dbName;
