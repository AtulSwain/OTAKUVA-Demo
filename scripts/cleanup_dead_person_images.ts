/**
 * Clear Person.imageUrl values that point at MyAnimeList images which don't
 * exist.
 *
 * Real Jikan-sourced person photos are signed URLs ("…/voiceactors/1/123.jpg?s=…")
 * and load fine. A handful of rows instead carry unsigned, sequential-looking
 * MAL URLs (e.g. /voiceactors/1/52901.jpg, /voiceactors/4/52904.jpg) that
 * were never provider data and 404 — flagged in CLAUDE.md. The UI already
 * falls back to initials, but the stored value is wrong.
 *
 * Safety:
 *   - dry run by default; --apply to write
 *   - only unsigned myanimelist.net URLs are candidates
 *   - each candidate is fetched; it's cleared only if the response is not an
 *     image (status >= 400 or a non-image content type). Network errors are
 *     skipped, never treated as "missing" (provider silence ≠ deletion)
 *   - old values are written to scripts/cleanup_logs/ (gitignored) first
 *
 * Usage:
 *   npx tsx scripts/cleanup_dead_person_images.ts
 *   npx tsx scripts/cleanup_dead_person_images.ts --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';

const apply = process.argv.includes('--apply');
const LOG_DIR = path.join(process.cwd(), 'scripts', 'cleanup_logs');

async function probe(url: string): Promise<'dead' | 'ok' | 'unknown'> {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const type = res.headers.get('content-type') || '';
    if (res.status >= 400 || !type.startsWith('image/')) return 'dead';
    return 'ok';
  } catch {
    return 'unknown';
  }
}

async function main() {
  const candidates = await prisma.person.findMany({
    where: { imageUrl: { contains: 'myanimelist.net' }, NOT: { imageUrl: { contains: '?s=' } } },
    select: { id: true, name: true, slug: true, imageUrl: true },
  });
  console.log(`${candidates.length} unsigned MyAnimeList person image URL(s) to check.`);

  const dead: typeof candidates = [];
  for (const person of candidates) {
    const result = await probe(person.imageUrl!);
    console.log(`  ${result.padEnd(7)} ${person.name} — ${person.imageUrl}`);
    if (result === 'dead') dead.push(person);
  }

  if (dead.length === 0) {
    console.log('\nNothing to clear.');
    return;
  }
  if (!apply) {
    console.log(`\nDry run: ${dead.length} image URL(s) would be cleared. Re-run with --apply.`);
    return;
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, `dead_person_images_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(logPath, JSON.stringify({ clearedAt: new Date().toISOString(), rows: dead }, null, 2));

  await prisma.person.updateMany({ where: { id: { in: dead.map((p) => p.id) } }, data: { imageUrl: null } });
  console.log(`\nCleared ${dead.length} image URL(s). Old values logged to ${path.relative(process.cwd(), logPath)}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
