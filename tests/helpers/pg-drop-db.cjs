// Counterpart to pg-create-db.cjs — drops a test file's throwaway
// database at process exit. WITH (FORCE) (Postgres 13+) terminates any
// lingering connections first, so this doesn't race a Prisma Client
// that's a moment behind on actually closing its socket after
// prisma.$disconnect().
const { Client } = require('pg');

async function main() {
  const dbName = process.env.PG_TARGET_DB;
  if (!/^otakuva_test_[a-f0-9]{12}$/.test(dbName || '')) {
    throw new Error(`Refusing to drop database with unexpected name: ${dbName}`);
  }
  const client = new Client({ connectionString: process.env.PG_ADMIN_URL });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await client.end();
}

main().catch((err) => {
  // Best-effort cleanup — an orphaned throwaway test database is harmless
  // clutter, not a reason to fail the test run. scripts/reset_test_dbs.ts
  // sweeps up anything left behind.
  console.error('[pg-drop-db] cleanup failed (non-fatal):', err.message || err);
});
