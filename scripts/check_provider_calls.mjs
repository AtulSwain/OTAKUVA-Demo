#!/usr/bin/env node
/**
 * CI / pre-test guard: fails if any file outside the approved provider
 * adapters makes a direct HTTP call to a third-party anime provider
 * (api.jikan.moe, graphql.anilist.co, ...).
 *
 * Per CLAUDE.md: "The frontend (src/app, src/components) must never call a
 * third-party API directly — always through src/app/api/** reading from
 * Prisma. Provider-specific logic stays inside src/lib/providers/** /
 * src/lib/news/**, never in components."
 *
 * This also covers the narrower rule that all Jikan traffic specifically
 * must flow through src/lib/jikanService.ts, which owns pacing/retry/cache
 * — a direct fetch() to api.jikan.moe anywhere else silently bypasses that
 * throttle and can trip Jikan's rate limiting for the whole app.
 *
 * Run: node scripts/check_provider_calls.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Directories that are allowed to reference/call these provider hosts
// directly, either because they ARE the shared client (jikanService.ts,
// src/lib/providers/**) or because they're not app code (scripts, docs,
// tests, config).
const ALLOWED_FILES = new Set([
  path.join('src', 'lib', 'jikanService.ts'),
]);

const ALLOWED_DIR_PREFIXES = [
  path.join('src', 'lib', 'providers') + path.sep,
  'scripts' + path.sep,
  'docs' + path.sep,
  'tests' + path.sep,
];

const SCAN_DIRS = ['src', 'scripts'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build']);

// The literal hosts a direct fetch/axios/GraphQL call would hit. Deliberately
// NOT matching e.g. myanimelist.net or anilist.co page links (data, not API
// calls) — only the actual API endpoints.
const FORBIDDEN_PATTERNS = [/api\.jikan\.moe/, /graphql\.anilist\.co/];

// Escape hatch for lines that reference the host as plain text/display data
// rather than issuing an HTTP call with it (e.g. an admin UI showing the
// configured endpoint as a fallback string). Use sparingly and only when the
// line genuinely never triggers a network request.
const IGNORE_MARKER = 'provider-call-check-ignore';

function isAllowed(relPath) {
  if (ALLOWED_FILES.has(relPath)) return true;
  return ALLOWED_DIR_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry))) {
      out.push(full);
    }
  }
}

const files = [];
for (const dir of SCAN_DIRS) {
  const full = path.join(ROOT, dir);
  try {
    walk(full, files);
  } catch {
    // dir doesn't exist, skip
  }
}

const violations = [];
for (const file of files) {
  const relPath = path.relative(ROOT, file);
  if (isAllowed(relPath)) continue;

  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes(IGNORE_MARKER)) return;
    if (FORBIDDEN_PATTERNS.some((re) => re.test(line))) {
      violations.push({ file: relPath, line: i + 1, text: line.trim() });
    }
  });
}

if (violations.length > 0) {
  console.error('\n✖ Direct provider API calls found outside approved files:\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  console.error(
    '\nAll Jikan/AniList traffic must go through src/lib/jikanService.ts or ' +
      'src/lib/providers/** so it gets the shared pacing, retry, and cache ' +
      'behavior. Route the call through those instead of fetching the ' +
      'provider directly.\n'
  );
  process.exit(1);
} else {
  console.log('✓ No direct provider API calls found outside approved files.');
}
