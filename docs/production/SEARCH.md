# OTAKUVA — Anime/Person/Character Search

Added 2026-09-16 (`prisma/migrations/20260916120000_add_search_fts_trgm`,
`src/lib/fuzzySearch.ts`). Replaces plain `contains`/ILIKE substring
matching with Postgres full-text search (`tsvector`/`tsquery`) plus the
`pg_trgm` extension for typo-tolerant fuzzy matching, across `AnimeTitle`
(every title type — official/english/japanese/romaji/synonym/
alternative), `Anime.canonicalTitle`, `Person.name`, and `Character.name`.

## 1. What was there before

An audit of every anime/character/person search entry point
(`src/lib/search.ts`, `src/lib/engine/anime/animeCatalogEngine.ts`,
`src/app/api/search/route.ts`, `src/app/api/people/route.ts`) found:

- Every one used a plain Prisma `contains` — a Postgres `ILIKE`/`LIKE`
  wildcard scan with **zero typo tolerance**: one misspelled or
  transposed character and the query matched nothing.
- **`animeCatalogEngine.ts` (the query behind `GET /api/anime`, the
  actual catalog/browse page) had no `mode: 'insensitive'` at all** —
  a real, live bug: Postgres's `contains` is case-sensitive by default
  (unlike SQLite's, which this app ran on before its 2026-09-14 Postgres
  migration — see `CLAUDE.md`'s Phase 10 backlog), so a lowercase query
  against a properly-capitalized title returned nothing. This had zero
  test coverage before this change (see §4).
- `Character` had **no search endpoint at all** — not a bug, a gap.
  `GET /api/characters/[slug]` only does an exact slug/id/name lookup.
- Neither `Anime.canonicalTitle`, `Character.name`, nor `Person.name`
  had any index beyond the implicit unique index on `slug` — every
  `contains` query was a full sequential scan regardless of catalog
  size, and a plain btree index (the only kind `AnimeTitle.title`/
  `searchableTitle` had) doesn't accelerate `contains`/`ILIKE '%term%'`
  anyway (only a prefix `LIKE 'term%'` benefits from a btree).
- `AnimeTitle.searchableTitle` — a normalized-title column meant to
  back search — is written by **three different, inconsistent
  normalization functions** across the ingestion/dedup pipeline
  (`src/lib/syncEngine.ts`'s `normalizeSearchTitle()`, `src/lib/catalog/
  canonicalDeduplicationMigration.ts`'s plain `.toLowerCase()`, and
  `src/lib/catalog/entityResolver.ts`'s `CatalogNormalizer.
  generateSearchKey()`). Rather than trust that column's consistency,
  the new indexes and queries work directly off the raw `title`/
  `canonicalTitle`/`name` columns via `lower(...)` — `searchableTitle`
  is still included in the generated `tsvector` as a secondary signal,
  but nothing is load-bearing on it being reliably normalized.

## 2. What's there now

### 2.1 Schema (`prisma/migrations/20260916120000_add_search_fts_trgm`)

- `CREATE EXTENSION IF NOT EXISTS pg_trgm` — trusted since Postgres 13,
  no superuser needed.
- `AnimeTitle.searchVector` — a `GENERATED ALWAYS AS (...) STORED`
  `tsvector` column combining `title` and `searchableTitle`, indexed
  with a GIN index. Uses the `'simple'` text search config (lowercases,
  no English stemming/stopwords — anime titles are proper nouns across
  many languages, where stemming does more harm than good).
- GIN trigram indexes (`gin_trgm_ops`) on `lower(title)` /
  `lower("canonicalTitle")` / `lower(name)` for `AnimeTitle`, `Anime`,
  `Person`, and `Character` — case-insensitive by construction (the
  index is built on the lowercased expression, and queries must compare
  against the same expression for Postgres to use it).
- **Deliberately not declared in `prisma/schema.prisma`**: a generated
  column and expression (`lower(...)`) indexes aren't representable in
  Prisma's schema language. This is Prisma's own documented pattern for
  this exact scenario — see the migration file's header comment. All
  access goes through `prisma.$queryRaw` (`src/lib/fuzzySearch.ts`),
  never the generated Prisma Client types, so schema.prisma never needs
  to know these objects exist.
- `tests/helpers/setupTestDb.ts` applies this exact migration file via
  `prisma db execute` right after `prisma db push` (which never runs
  migration files on its own) — one source of truth for both real
  deploys and test databases.

### 2.2 Query layer (`src/lib/fuzzySearch.ts`)

Three exported functions — `searchAnimeIdsByTitle`,
`searchPersonIdsByName`, `searchCharacterIdsByName` (the last one not
wired into a route yet, since none exists — see §1) — each returning
ranked `{id, rank}` pairs. Ranking combines, highest first:

1. **Exact substring match** (rank ≥ 2) — what `contains` used to catch;
   exact/prefix searches keep behaving exactly as before.
2. **Trigram word-similarity** (`word_similarity()`, the `<%` operator)
   — typo-tolerant. `pg_trgm`'s own default `word_similarity_threshold`
   (0.6) proved too strict in practice against this app's real titles —
   e.g. "freiren" (a real single-transposition typo) against "Frieren:
   Beyond Journey's End" scores ~0.33, and "jujustu kaisen" against
   "Jujutsu Kaisen" scores ~0.58 — both would be silently excluded at
   0.6. Lowered to 0.3 (matching `pg_trgm`'s own convention for its
   older `similarity()`/`%` operator) via `SET LOCAL
   pg_trgm.word_similarity_threshold` inside the same transaction as
   the search query (session-level `SET` isn't safe on a pooled
   connection — it could leak into an unrelated later query reusing the
   same connection).
3. **Full-text `ts_rank`** — rewards whole-word/multi-word relevance on
   top of the trigram score, using the generated `searchVector` column.

**Known limitation**: trigram similarity is mathematically weakest for
short (< 8 character) single words with a *mid-word* letter
transposition — e.g. "freiren" vs "Frieren" scores lower than some
unrelated titles happen to. Still strictly better than the old
`contains` (zero results for any typo, always), and realistic multi-word
typos — the common case — score very cleanly (see §3). Not fixed further
here; `fuzzystrmatch`'s `levenshtein()` as a tie-breaker for short single-
word queries specifically would be the next step if this matters more in
practice than the benchmark below suggests.

**A real finding worth calling out explicitly, not just in code
comments**: `searchAnimeIdsByTitle`'s query is a `UNION ALL` of two
single-table-scoped subqueries (one over `Anime` alone, one over
`AnimeTitle` joined back to `Anime`) rather than the more obvious single
query — `SELECT ... FROM "Anime" a LEFT JOIN "AnimeTitle" at ON ... WHERE
(a.col... OR at.col...)`. Those two forms return identical results, but
**the join-OR form silently defeats every index this migration
creates.** Confirmed via `EXPLAIN ANALYZE` against a 30k-row synthetic
catalog: Postgres can only push a `WHERE` condition down as an index
qual on the table it actually scans, and a condition that references
columns from *both* sides of a join can't be evaluated until after the
join has already run — so the planner fell back to a full sequential
scan of both `Anime` and `AnimeTitle` on every single query, regardless
of the GIN trigram/full-text indexes sitting right there unused
(measured: ~700-900ms per query at 30k rows). Splitting into two
independently-filterable subqueries lets the planner push each
condition down to its own table and combine `LIKE` + `<%` + `@@` via a
`BitmapOr` across all three indexes — the *identical* logical query,
restructured this way, ran in under 1ms against the same data. This is
exactly the kind of thing that looks fine in code review, passes every
correctness test, and only shows up as a problem under a real-scale
benchmark — which is the whole reason this task asked for one rather
than trusting the migration + a green test suite alone.

### 2.3 Callers updated

- `src/lib/search.ts` (`searchCatalog`, used by `/api/anime/search`)
- `src/lib/engine/anime/animeCatalogEngine.ts` (`queryAnimeCatalog`,
  used by `GET /api/anime` — the case-sensitivity bug fix)
- `src/app/api/search/route.ts` (the global multi-entity search widget
  — anime and person branches)
- `src/app/api/people/route.ts` (the people directory search)

Each keeps its prior *display* ordering (score/popularity for anime,
alphabetical where that was already the case) — the fuzzy layer changes
*which* rows match, not how matches are subsequently sorted, except
where no ordering signal existed before (the global search widget's
person results now order by match rank, since there was no other
ranking signal for people). Studio/genre/tag matching (a secondary
concern bundled into the same `OR` clauses) is untouched — this
migration's scope is title/name matching specifically, per its remit.

## 3. Benchmark

`scripts/benchmark_search.ts` — builds its own throwaway Postgres
database (same pattern as `tests/helpers/setupTestDb.ts`, dropped on
exit), bulk-seeds a synthetic catalog server-side via `generate_series`
(individually inserting tens of thousands of rows from Node would itself
take longer than the benchmark), embeds five real, well-known anime
titles among the synthetic noise, and times the **old** query shape
(reproduced faithfully in raw SQL, since the old code no longer exists
to call) against the **new** one across 15 queries (exact / lowercase /
typo variants of those five titles) × 20 runs each.

Run: `npx tsx scripts/benchmark_search.ts --rows=30000` (30,000 anime +
30,000 AnimeTitle rows — representative of a full MAL-scale catalog;
this app's real dev database has ~360 anime as of this writing, far
below where an index makes any measurable difference, which is exactly
why this needed a synthetic catalog rather than benchmarking against it
directly).

**Results** (2026-09-16, 30,000 anime / 30,000 AnimeTitle rows, 300 runs
per implementation — 15 queries × 20 runs each):

| | Recall | avg | p50 | p95 | min | max |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OLD** (`contains`/`LIKE`, case-sensitive, no typo tolerance) | 100/300 | 66.25ms | 65.35ms | 103.79ms | 29.85ms | 142.19ms |
| **NEW** (full-text + pg_trgm) | **300/300** | **45.66ms** | **8.86ms** | 31.84ms | 2.47ms | 1077.55ms |

`EXPLAIN ANALYZE` on the new query for an exact-match term: **0.666ms**
execution time, `BitmapOr` across `Anime_canonicalTitle_trgm_idx`,
`AnimeTitle_title_trgm_idx`, and `AnimeTitle_searchVector_idx` (full
plan in this doc's git history / re-run the benchmark for a fresh one).

**Reading these numbers**: recall is the headline result — the old
implementation structurally cannot match 200 of these 300 runs (every
lowercase or misspelled variant of a real title), by construction, no
matter the catalog size; that was the actual problem this migration
fixes (§1), not primarily speed. Speed turned out to *also* improve:
the new implementation's p50 (8.86ms) is roughly 7× faster than the
old one's (65.35ms), and even its average (45.66ms) beats the old
one's (66.25ms) despite doing substantially more per-matched-row work
(trigram similarity + full-text ranking, not just a substring test) —
because the GIN indexes turn most queries into a sub-millisecond
`BitmapOr` lookup instead of a full sequential scan of both tables (the
old implementation always pays that sequential-scan cost, win or lose,
since a plain `contains` has no index to fall back on for a `%term%`
pattern). The new implementation's p95/max are its weak spot relative
to its own median (31.84ms / 1077.55ms vs an 8.86ms p50) — driven by
this benchmark's broadest synthetic queries (two-word combinations built
from a 10×10 vocabulary, so a query like "sword academy" genuinely
matches thousands of the synthetic rows, not a handful) forcing a
larger result set through the `word_similarity`/`ts_rank` computation
and the `SET LOCAL`-per-call transaction wrapper; a real catalog's
title vocabulary is far less repetitive than this synthetic one, so
real queries should sit closer to the p50 than the max. Worth
re-benchmarking after this ships against real production title data
rather than assuming the synthetic distribution transfers exactly.

## 4. Test coverage

`tests/fuzzy-search.test.ts` — case-insensitivity (the regression fix),
typo tolerance on realistic multi-word queries, alternate/romanized
`AnimeTitle` matching, `MERGED`-anime exclusion, exact-match ranking
ahead of fuzzy-only matches, empty-query handling, and person/character
name search — plus regression tests directly against
`AnimeCatalogEngine.queryAnimeCatalog`, `searchCatalog`, and
`GET /api/people` (the actual call sites), not just the underlying
`fuzzySearch.ts` functions in isolation.
