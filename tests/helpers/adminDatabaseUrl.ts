/**
 * Where the test suite (and the test-DB scripts) connect to create and drop
 * throwaway databases: the same Postgres server as the app, but its
 * `postgres` maintenance database (CREATE DATABASE has to run from somewhere).
 *
 *   1. TEST_DATABASE_ADMIN_URL, if set (CI sets it explicitly);
 *   2. otherwise DATABASE_URL — from the environment or the repo's local
 *      `.env` (tsx doesn't load .env itself) — with the database swapped for
 *      `postgres`.
 *
 * No credentials are hard-coded here (the repo is public — a default
 * password used to live in this fallback). Neither set → a clear error.
 */
import fs from 'fs';
import path from 'path';

function fromDotEnv(name: string): string | undefined {
  try {
    const text = fs.readFileSync(path.resolve(__dirname, '..', '..', '.env'), 'utf8');
    const m = text.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]*)"?`, 'm'));
    return m?.[1] || undefined;
  } catch {
    return undefined;
  }
}

export function resolveAdminDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_ADMIN_URL || fromDotEnv('TEST_DATABASE_ADMIN_URL');
  if (explicit) return explicit;
  const appUrl = process.env.DATABASE_URL || fromDotEnv('DATABASE_URL');
  if (!appUrl) {
    throw new Error(
      'Set TEST_DATABASE_ADMIN_URL (or DATABASE_URL in .env) — the tests create throwaway databases on that Postgres server.'
    );
  }
  const url = new URL(appUrl);
  url.pathname = '/postgres';
  url.search = '';
  return url.toString();
}
