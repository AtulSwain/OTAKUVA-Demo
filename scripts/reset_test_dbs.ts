/**
 * OTAKUVA — sweeps up orphaned `otakuva_test_*` Postgres databases.
 *
 * Usage: npx tsx scripts/reset_test_dbs.ts
 *
 * Each `npm test` file creates its own throwaway `otakuva_test_<hash>`
 * database (tests/helpers/setupTestDb.ts) and drops it again on exit. A
 * test run that's killed (Ctrl+C mid-run, an OOM, a CI job cancelled)
 * skips that exit handler and leaves its database behind — harmless
 * clutter, but this cleans it up. Never touches `otakuva` or
 * `otakuva_test` (the app's real databases) — only names matching
 * `otakuva_test_<12 hex chars>`, the exact pattern setupTestDb.ts
 * generates.
 */
import { Client } from 'pg';
import { resolveAdminDatabaseUrl } from '../tests/helpers/adminDatabaseUrl';

const ADMIN_DATABASE_URL = resolveAdminDatabaseUrl();

const ORPHAN_PATTERN = /^otakuva_test_[a-f0-9]{12}$/;

async function main() {
  const client = new Client({ connectionString: ADMIN_DATABASE_URL });
  await client.connect();

  const res = await client.query<{ datname: string }>(
    `SELECT datname FROM pg_database WHERE datistemplate = false`
  );
  const orphans = res.rows.map((r) => r.datname).filter((name) => ORPHAN_PATTERN.test(name));

  if (orphans.length === 0) {
    console.log('No orphaned test databases found.');
  } else {
    console.log(`Dropping ${orphans.length} orphaned test database(s): ${orphans.join(', ')}`);
    for (const name of orphans) {
      await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      console.log(`  dropped ${name}`);
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
