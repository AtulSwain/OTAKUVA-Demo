/**
 * Postgres full-text-search + pg_trgm typo-tolerant fuzzy search.
 *
 * Backed by prisma/migrations/20260916120000_add_search_fts_trgm — see
 * that file and docs/production/SEARCH.md for the schema/design this
 * relies on (a generated tsvector column on AnimeTitle, GIN trigram
 * indexes on AnimeTitle.title, Anime.canonicalTitle, Person.name,
 * Character.name). Replaces the old `contains`/ILIKE substring search
 * (src/lib/search.ts, src/lib/engine/anime/animeCatalogEngine.ts,
 * src/app/api/search/route.ts, src/app/api/people/route.ts), which had
 * zero typo tolerance and forced a full sequential scan on every query.
 *
 * Raw SQL via $queryRaw, not the generated Prisma Client, because none
 * of pg_trgm's operators/functions (word_similarity, the `<%` operator,
 * `@@`/tsvector matching) are expressible through Prisma's query
 * builder — this is the documented approach for Postgres full-text
 * search with Prisma.
 */
import { prisma } from './prisma';

export interface RankedMatch {
  id: string;
  rank: number;
}

// pg_trgm's own `%`/similarity() operator defaults to a 0.3 similarity
// threshold; the newer word_similarity()/`<%` operator defaults to a
// stricter 0.6, which is too strict for this app's queries in practice —
// e.g. "freiren" (a real single-letter-transposition typo) against
// "Frieren: Beyond Journey's End" scores ~0.33 word_similarity, and a
// multi-word typo like "jujustu kaisen" against "Jujutsu Kaisen" scores
// ~0.58 — both would be silently excluded at the 0.6 default. Matching
// pg_trgm's own 0.3 convention here instead. Session-scoped GUCs aren't
// safe to just SET on a pooled connection (it could leak into an
// unrelated later query on the same connection), so this is set with
// SET LOCAL inside the same transaction as the search query — scope
// ends when the transaction does.
const WORD_SIMILARITY_THRESHOLD = 0.3;

async function setFuzzyThreshold(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  await tx.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = ${WORD_SIMILARITY_THRESHOLD}`);
}

/**
 * Ranked anime ids matching `term` against AnimeTitle (every
 * type — official/english/japanese/romaji/synonym/alternative) and
 * Anime.canonicalTitle. Ranking, highest first:
 *  1. An exact substring match anywhere in the title (rank >= 2) — this
 *     is what `contains` used to catch, so exact/prefix searches keep
 *     behaving exactly as before, just now merged with fuzzy results
 *     rather than being the only thing that could match.
 *  2. Trigram word-similarity (rank in [0, 1)) — typo-tolerant: a
 *     misspelled query like "fullmetal alchemest" or "atatck on titan"
 *     still finds the right title. Weakest for single short (<8 char)
 *     words with a mid-word letter transposition — pg_trgm's own
 *     mathematical limit at that length, not a bug here; still strictly
 *     better than contains, which returns nothing at all for any typo.
 *  3. Full-text ts_rank (folded into the same [0, 1) range) — rewards
 *     whole-word/multi-word relevance on top of the trigram score.
 * Returns at most `limit` anime ids, most relevant first. Excludes
 * MERGED anime (matching every existing search entry point's behavior).
 *
 * Written as a UNION ALL of two single-table-scoped subqueries (Anime
 * alone, AnimeTitle joined back to Anime) rather than one query with
 * `WHERE (a.col... OR at.col...)` across a single join — the two look
 * equivalent, but they are not to the query planner. Confirmed via
 * EXPLAIN ANALYZE against a 30k-row synthetic catalog (see
 * scripts/benchmark_search.ts / docs/production/SEARCH.md §3): the OR-
 * across-a-join form made every one of AnimeTitle_title_trgm_idx,
 * Anime_canonicalTitle_trgm_idx, and AnimeTitle_searchVector_idx
 * unusable — Postgres can only push a WHERE condition down as an index
 * qual on the table it actually filters, and a condition spanning both
 * sides of a join can't be evaluated until after the join runs, so it
 * fell back to a full sequential scan of both tables (~700-900ms at 30k
 * rows). Each condition below is scoped to one table, which lets the
 * planner use a BitmapOr across all three indexes per branch — the
 * identical query, restructured this way, ran in ~1-2ms against the
 * same data. Never restructure this back into a single cross-table OR
 * without re-checking EXPLAIN ANALYZE.
 */
export async function searchAnimeIdsByTitle(term: string, limit: number): Promise<RankedMatch[]> {
  const cleaned = term.trim();
  if (!cleaned) return [];
  const p = titleMatchPatterns(cleaned);

  // Rank tiers (2026-11-02, owner: "a specific anime should come to the
  // top"): whole title equal to the query (10) > title starts with it (6)
  // > contains it as a whole word (4) > contains it (3) > fuzzy/typo match
  // (0–1). Similarity is added on top so closer titles win inside a tier;
  // ties go to the more popular show. Where-clauses are unchanged (they're
  // what keeps the trigram/full-text indexes usable — see above).
  return prisma.$transaction(async (tx) => {
    await setFuzzyThreshold(tx);
    return tx.$queryRaw<RankedMatch[]>`
      SELECT m.id, m.rank FROM (
        SELECT id, MAX(rank) AS rank FROM (
          SELECT a.id,
                 (CASE
                    WHEN ${p.exact} <> '' AND regexp_replace(lower(a."canonicalTitle"), '[[:space:][:punct:]]+', '', 'g') = ${p.exact} THEN 10
                    WHEN lower(a."canonicalTitle") LIKE ${p.prefix} THEN 6
                    WHEN ${p.word} <> '' AND lower(a."canonicalTitle") ~ ${p.word} THEN 4
                    WHEN lower(a."canonicalTitle") LIKE ${p.like} THEN 3
                    ELSE 0 END)
                   + 0.45 * word_similarity(lower(${cleaned}), lower(a."canonicalTitle"))
                   + 0.45 * similarity(lower(${cleaned}), lower(a."canonicalTitle")) AS rank
          FROM "Anime" a
          WHERE a.status != 'MERGED'
            AND (
              lower(a."canonicalTitle") LIKE ${p.like}
              OR lower(${cleaned}) <% lower(a."canonicalTitle")
            )
          UNION ALL
          SELECT at."animeId" AS id,
                 -- Nicknames/synonyms count for less than a show's real titles.
                 (CASE WHEN at.type IN ('synonym', 'alternative') THEN 0.5 ELSE 1 END) * (CASE
                    WHEN ${p.exact} <> '' AND regexp_replace(lower(at.title), '[[:space:][:punct:]]+', '', 'g') = ${p.exact} THEN 10
                    WHEN lower(at.title) LIKE ${p.prefix} THEN 6
                    WHEN ${p.word} <> '' AND lower(at.title) ~ ${p.word} THEN 4
                    WHEN lower(at.title) LIKE ${p.like} THEN 3
                    ELSE 0 END)
                   + 0.45 * LEAST(1, GREATEST(
                       word_similarity(lower(${cleaned}), lower(at.title)),
                       COALESCE(ts_rank(at."searchVector", plainto_tsquery('simple', ${cleaned})), 0)
                     ))
                   + 0.45 * similarity(lower(${cleaned}), lower(at.title)) AS rank
          FROM "AnimeTitle" at
          JOIN "Anime" a2 ON a2.id = at."animeId" AND a2.status != 'MERGED'
          WHERE (
            lower(at.title) LIKE ${p.like}
            OR lower(${cleaned}) <% lower(at.title)
            OR at."searchVector" @@ plainto_tsquery('simple', ${cleaned})
          )
        ) matches
        GROUP BY id
      ) m
      JOIN "Anime" pa ON pa.id = m.id
      -- Same tier → the more popular show first (floor drops the <0.9
      -- similarity bonus); typo-only matches (<1.5) stay ordered by closeness.
      ORDER BY (CASE WHEN m.rank >= 1.5 THEN floor(m.rank) ELSE m.rank END) DESC,
               GREATEST(COALESCE(pa.members, 0), COALESCE(pa."scoredBy", 0),
                        CASE WHEN pa."externalSource" = 'anilist' THEN COALESCE(pa.popularity, 0) ELSE 0 END) DESC,
               m.rank DESC,
               pa.id
      LIMIT ${limit}
    `;
  });
}

/** Rank tier of a fuzzySearch match: 'exact' title, a title 'match', or only 'similar'. */
export function matchKind(rank: number): 'exact' | 'title' | 'similar' {
  return rank >= 10 ? 'exact' : rank >= 1.5 ? 'title' : 'similar';
}

const ASCII_PUNCT_OR_SPACE = /[\s!-\/:-@\[-`{-~]+/g;
// LIKE's default escape character is a backslash.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Patterns for the rank tiers above — exported for tests. */
export function titleMatchPatterns(term: string) {
  const lower = term.trim().toLowerCase();
  // Postgres side: regexp_replace(lower(title), '[[:space:][:punct:]]+', '') —
  // same ASCII punctuation/space set, so "Re:Zero" = "rezero".
  const exact = lower.replace(ASCII_PUNCT_OR_SPACE, '');
  // \m…\M word boundaries only make sense when the query starts and ends on a word character.
  const word = /^\w/.test(lower) && /\w$/.test(lower) ? `\\m${escapeRegex(lower)}\\M` : '';
  return { exact, prefix: `${escapeLike(lower)}%`, like: `%${escapeLike(lower)}%`, word };
}

async function searchNameTable(table: 'Person' | 'Character', term: string, limit: number): Promise<RankedMatch[]> {
  const cleaned = term.trim();
  if (!cleaned) return [];
  const likePattern = `%${cleaned}%`;

  return prisma.$transaction(async (tx) => {
    await setFuzzyThreshold(tx);
    return tx.$queryRawUnsafe<RankedMatch[]>(
      `SELECT id,
              (CASE WHEN lower(name) LIKE lower($1) THEN 2 ELSE 0 END)
                + word_similarity(lower($2), lower(name)) AS rank
       FROM "${table}"
       WHERE lower(name) LIKE lower($1)
          OR lower($2) <% lower(name)
       ORDER BY rank DESC
       LIMIT $3`,
      likePattern,
      cleaned,
      limit
    );
  });
}

/**
 * Ranked Person ids (staff/voice actors) matching `term` against
 * Person.name, trigram word-similarity only — a person's name is a
 * single short string, not a multi-language title collection, so
 * there's no separate full-text layer here the way there is for anime.
 */
export function searchPersonIdsByName(term: string, limit: number): Promise<RankedMatch[]> {
  return searchNameTable('Person', term, limit);
}

/**
 * Ranked Character ids matching `term` against Character.name. Same
 * shape as searchPersonIdsByName — not wired into a route yet (no
 * character search endpoint exists in this codebase today), included
 * because the trigram index already exists and a future
 * `GET /api/characters?q=` should use this rather than a fresh
 * `contains` implementation.
 */
export function searchCharacterIdsByName(term: string, limit: number): Promise<RankedMatch[]> {
  return searchNameTable('Character', term, limit);
}
