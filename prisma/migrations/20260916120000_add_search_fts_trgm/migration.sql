-- Postgres full-text search + pg_trgm fuzzy/typo-tolerant search for
-- anime titles (including alternate/romanized AnimeTitle rows) and
-- person/character names. See docs/production/SEARCH.md for the design
-- and benchmark this replaces (plain `contains`/ILIKE, which forces a
-- full sequential scan for every search and has no typo tolerance).
--
-- Deliberately NOT declared in prisma/schema.prisma: the generated
-- tsvector column and the expression-based (lower(...)) trigram indexes
-- below aren't representable in Prisma's schema language (Prisma's
-- declarative @@index can target a column, not an arbitrary SQL
-- expression like lower(title)), so this follows Prisma's documented
-- pattern for this exact scenario — a hand-written migration, left
-- unmanaged by `prisma db push`/`migrate dev` schema diffing. All access
-- to these objects goes through prisma.$queryRaw (src/lib/search/**),
-- never the generated Prisma Client types, so there's no need for
-- schema.prisma to know about them.
--
-- Test databases (tests/helpers/setupTestDb.ts) are built via
-- `prisma db push` alone, which never runs migration.sql files — that
-- helper applies this exact file via `prisma db execute` right after
-- the push, so test DBs and real deployments end up with the identical
-- schema this file describes.

-- pg_trgm: trigram similarity or "%"/similarity() operator, the typo-
-- tolerant/fuzzy-substring half of this migration. Trusted since
-- Postgres 13, so this doesn't require superuser — the app's own
-- database-owner role can create it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search: to_tsvector/tsquery are built into Postgres core,
-- no extension needed. A STORED generated column keeps this in sync
-- automatically on every INSERT/UPDATE to AnimeTitle, indexed once here
-- rather than computed per query. Combines the raw title with
-- searchableTitle (best-effort normalized at ingestion — see
-- docs/production/SEARCH.md for a caveat on that column's consistency)
-- so a query against either surfaces a match. 'simple' config (not
-- 'english') deliberately skips English stemming/stopwords — anime
-- titles are proper nouns in many languages, where stemming would do
-- more harm than good, but 'simple' still lowercases for
-- case-insensitive matching.
ALTER TABLE "AnimeTitle"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce("searchableTitle", ''))
  ) STORED;

CREATE INDEX "AnimeTitle_searchVector_idx" ON "AnimeTitle" USING GIN ("searchVector");

-- Trigram (GIN) indexes for typo-tolerant fuzzy matching and fast
-- substring search, case-insensitive via a lower(...) expression index
-- — queries must compare lower(term) against these same expressions for
-- Postgres to actually use the index rather than falling back to a
-- sequential scan.
CREATE INDEX "AnimeTitle_title_trgm_idx" ON "AnimeTitle" USING GIN (lower(title) gin_trgm_ops);
CREATE INDEX "Anime_canonicalTitle_trgm_idx" ON "Anime" USING GIN (lower("canonicalTitle") gin_trgm_ops);
CREATE INDEX "Person_name_trgm_idx" ON "Person" USING GIN (lower(name) gin_trgm_ops);
CREATE INDEX "Character_name_trgm_idx" ON "Character" USING GIN (lower(name) gin_trgm_ops);
