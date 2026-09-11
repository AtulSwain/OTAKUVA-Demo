/**
 * Test database bootstrap — import this FIRST in every test file, before
 * anything that constructs a PrismaClient.
 *
 * It pushes the Prisma schema into a brand-new SQLite file in the OS temp
 * directory and points DATABASE_URL at it. Tests therefore start from an
 * empty schema, create only the rows they need, and never read or write
 * prisma/dev.db. (The ad-hoc src/lib/test_*.ts scripts wrote fixtures into
 * dev.db, which is how "Mind Paradox 1788674684858" ended up in the catalog.)
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');
const schemaPath = path.join(repoRoot, 'prisma', 'schema.prisma');
const prismaCli = require.resolve('prisma/build/index.js', { paths: [repoRoot] });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otakuva-test-'));
const dbFile = path.join(dir, 'test.db');
const databaseUrl = `file:${dbFile.replace(/\\/g, '/')}`;

if (/dev\.db/i.test(databaseUrl) || dbFile.startsWith(path.join(repoRoot, 'prisma'))) {
  throw new Error(`Refusing to run tests against ${databaseUrl}`);
}

process.env.DATABASE_URL = databaseUrl;
process.env.AUTH_SECRET = 'otakuva-test-only-secret-0123456789abcdef';
// Uploads go to the local provider inside this temp dir, never R2 or public/.
process.env.STORAGE_PROVIDER = 'local';
process.env.LOCAL_UPLOADS_ROOT = path.join(dir, 'uploads');
delete process.env.GIPHY_API_KEY;
// Keep the dev-mode Prisma global cache and non-production auth behaviour.
(process.env as Record<string, string>).NODE_ENV = 'test';

execFileSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--schema', schemaPath], {
  env: process.env,
  stdio: 'pipe',
});

export const TEST_DATABASE_URL = databaseUrl;
export const TEST_DB_DIR = dir;
