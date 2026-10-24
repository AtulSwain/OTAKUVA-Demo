// Tiny CJS helper, run as a child process from setupTestDb.ts (kept
// synchronous from the caller's point of view via execFileSync). Creates
// one throwaway Postgres database for a single test file's run. Plain
// require()-based CJS so it needs no build step / ESM top-level-await
// support from whatever runs it — see setupTestDb.ts for why this is a
// subprocess rather than inline async code.
const { Client } = require('pg');

async function main() {
  const dbName = process.env.PG_TARGET_DB;
  // Guards against ever creating something other than a generated
  // throwaway test database, no matter what calls this script.
  if (!/^otakuva_test_[a-f0-9]{12}$/.test(dbName || '')) {
    throw new Error(`Refusing to create database with unexpected name: ${dbName}`);
  }
  const client = new Client({ connectionString: process.env.PG_ADMIN_URL });
  await client.connect();
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();
}

main().catch((err) => {
  console.error('[pg-create-db] failed:', err.message || err);
  process.exit(1);
});
