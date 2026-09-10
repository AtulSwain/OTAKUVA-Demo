/**
 * OTAKUVA — NEWS ANIME-RELEVANCE CLASSIFIER
 *
 * Anime News Network, Anime Corner and MyAnimeList all cover general Japanese
 * gaming and entertainment alongside anime. Appearing in one of those feeds is
 * therefore not evidence that an article is anime-related, and roughly one in
 * ten ingested articles was pure console/gaming or sponsorship news.
 *
 * This classifier decides what belongs in the anime feed. It is deliberately
 * biased toward keeping articles:
 *
 *   ANIME_RELATED  any anime signal at all (lexicon, franchise, or a match
 *                  against a canonical Anime/Studio/Person in the DB)
 *   OFF_TOPIC      an explicit off-topic signal AND no anime signal whatsoever
 *   REVIEW         neither — kept visible, but flagged for an editor
 *
 * Only OFF_TOPIC is withheld from the public feed, and those rows are retained
 * rather than deleted so any misclassification is reversible (rule 6).
 *
 * Nothing here invents data: the verdict is derived only from the article's own
 * title/summary and the canonical catalog. Uncertainty resolves to REVIEW
 * rather than a guess.
 */

import { prisma } from '../../prisma';

export type NewsRelevance = 'ANIME_RELATED' | 'REVIEW' | 'OFF_TOPIC';

export interface RelevanceVerdict {
  relevance: NewsRelevance;
  /** Confidence that the article IS anime-related, 0..1. */
  score: number;
  /** Which signals fired, for auditability in the admin UI. */
  reason: string;
}

/**
 * Unambiguous anime/manga vocabulary. A single hit keeps an article, and
 * outranks any off-topic keyword — that is what lets a Fortnite collab with an
 * anime series stay in the feed.
 *
 * Terms here must not appear in ordinary non-anime writing. Bare "studio" used
 * to live in this list and matched "Xbox Game Studios", so studio references
 * are spelled out as full names instead.
 */
const ANIME_TERMS = [
  'anime', 'anime film', 'anime series', 'tv anime', 'manga', 'mangaka',
  'manhwa', 'manhua', 'webtoon', 'light novel', 'novel series',
  'ova', 'ona', 'oad', 'seiyuu', 'voice actor', 'voice actress', 'voice cast',
  'dub', 'dubbed', 'sub', 'subtitled', 'simulcast', 'cour', 'anisong',
  'shonen', 'shounen', 'shoujo', 'shojo', 'seinen', 'josei', 'isekai',
  'otaku', 'waifu', 'cosplay', 'doujin', 'visual novel',
  'animation studio', 'anime studio', 'key visual', 'character design',
  'opening theme', 'ending theme', 'op theme', 'ed theme', 'theme song',
  'season 2', 'season 3', 'new season',
  'crunchyroll', 'funimation', 'aniplex', 'kadokawa', 'shueisha', 'kodansha',
  'shogakukan', 'toei animation', 'madhouse', 'mappa', 'ufotable', 'bones',
  'kyoto animation', 'wit studio', 'cloverworks', 'a-1 pictures', 'trigger',
  'sunrise', 'production i.g', 'studio ghibli', 'ghibli', 'pierrot', 'gainax',
  'shonen jump', 'jump festa', 'comiket', 'anime expo', 'crunchyroll anime awards',
  'tokusatsu', 'magical girl', 'macross', 'godzilla', 'ultraman',
  'kamen rider', 'super sentai',
];

/**
 * Suggestive but not conclusive. These read as anime news inside these feeds
 * ("Episode 13 Finale", "4K Remaster") yet occur just as naturally in game
 * coverage, so an explicit off-topic subject outranks them — otherwise a
 * "Zelda 4K Remaster" headline would qualify on the word "remaster" alone.
 */
const WEAK_ANIME_TERMS = [
  'episode', 'finale', 'series finale', 'new series', 'adaptation',
  'live-action', 'remaster', '4k remaster', 'blu-ray', 'home video',
  'mecha', 'idol group', 'j-pop', 'solo album', 'premieres', 'premiere',
];

/**
 * Game and multimedia franchises that have anime or manga adaptations. The
 * product brief explicitly wants anime-game coverage, so news about these is
 * anime-related even when the article itself never says "anime".
 *
 * Entries here must genuinely have an anime/manga incarnation — this list is
 * the reason Persona and Yu-Gi-Oh! stay in the feed while Zelda and Metroid
 * do not.
 */
const ANIME_ADJACENT_FRANCHISES = [
  'persona', 'yu-gi-oh', 'yugioh', 'pokemon', 'pokémon', 'digimon',
  'yo-kai watch', 'yokai watch', 'fate/', 'fate grand order', 'danganronpa',
  'final fantasy', 'dragon quest', 'tales of', 'sonic', 'uma musume',
  'granblue', 'blue archive', 'genshin', 'honkai', 'nier', 'atelier',
  'street fighter', 'tekken', 'sakura wars', 'ace attorney', 'professor layton',
  'disgaea', 'prinny', 'fatal fury', 'king of fighters', 'tokyo revengers',
  'onimusha', 'devil may cry', 'castlevania', 'megaman', 'mega man',
  'kingdom hearts', 'dragon ball', 'naruto', 'one piece', 'gundam',
  'evangelion', 'sword art online', 're:zero', 'demon slayer', 'jujutsu kaisen',
  'chainsaw man', 'spy x family', 'my hero academia', 'attack on titan',
];

/**
 * Explicitly non-anime subject matter. These only ever matter when the article
 * carries no anime signal at all, so "Attack on Titan Collab Comes to Fortnite"
 * still stays in the feed.
 */
const OFF_TOPIC_TERMS = [
  // Console/PC hardware and platform news
  'switch 2', 'nintendo direct', 'nintendo switch 2', 'playstation 5', 'ps5 pro',
  'xbox series x', 'xbox series s', 'xbox game pass', 'steam deck', 'steam next fest',
  'epic games store', 'game pass',
  // Bare platform names. Safe to list because strong anime signals are tested
  // first, so an anime collaboration on one of these platforms still qualifies
  // before this list is ever consulted.
  'xbox', 'playstation', 'nintendo',
  // Non-anime game franchises
  'zelda', 'metroid', 'kirby', 'pikmin', 'donkey kong', 'super mario', 'mario kart',
  'splatoon', 'animal crossing', 'resident evil', 'monster hunter wilds',
  'call of duty', 'battlefield', 'fortnite', 'minecraft', 'grand theft auto',
  'elden ring', 'dark souls', 'cyberpunk 2077', 'the witcher', 'assassin\'s creed',
  'far cry', 'halo', 'forza', 'gran turismo', 'fifa', 'madden', 'nba 2k',
  'hyrule warriors', 'xenoblade', 'fire emblem engage', 'luigi\'s mansion',
  // Sport and non-entertainment business
  'horse rac', 'prix de l\'arc', 'grand prix', 'football', 'soccer', 'basketball',
  'baseball league', 'olympic', 'world cup', 'formula 1', 'motogp',
];

function buildMatcher(terms: string[]): RegExp {
  // Word boundaries stop short tokens like "ova" or "sub" matching inside
  // unrelated words. The boundary is applied per-side and only where the term
  // actually ends in an alphanumeric: a trailing guard on "fate/" would demand
  // a non-alphanumeric after the slash and so never match "Fate/EXTRA".
  const parts = terms.map((t) => {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lead = /^[a-z0-9]/i.test(t) ? '(?<![a-z0-9])' : '';
    const trail = /[a-z0-9]$/i.test(t) ? '(?![a-z0-9])' : '';
    return `${lead}${escaped}${trail}`;
  });
  return new RegExp(`(?:${parts.join('|')})`, 'i');
}

const ANIME_RE = buildMatcher(ANIME_TERMS);
const WEAK_ANIME_RE = buildMatcher(WEAK_ANIME_TERMS);
const FRANCHISE_RE = buildMatcher(ANIME_ADJACENT_FRANCHISES);
const OFF_TOPIC_RE = buildMatcher(OFF_TOPIC_TERMS);

/**
 * Folds typographic punctuation to ASCII so a term written "l'arc" still
 * matches a headline that uses a curly apostrophe ("Prix de L’Arc").
 */
function normalizeText(input: string): string {
  return input
    .replace(/[‘’ʼ′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase();
}

function firstMatch(re: RegExp, haystack: string): string | null {
  const m = haystack.match(re);
  return m ? m[0].replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '') : null;
}

/**
 * Whole-word containment for catalog entity names. A plain substring test let
 * the studio "Blade" match inside "Xenoblade", so every entity name is checked
 * with boundaries on both sides.
 */
function containsEntity(haystack: string, name: string): boolean {
  const escaped = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lead = /^[a-z0-9]/i.test(name) ? '(?<![a-z0-9])' : '';
  const trail = /[a-z0-9]$/i.test(name) ? '(?![a-z0-9])' : '';
  return new RegExp(`${lead}${escaped}${trail}`, 'i').test(haystack);
}

/**
 * Canonical-entity cache. The catalog is small enough (hundreds of anime and
 * studios) to hold in memory for the duration of an ingestion run, which keeps
 * this from issuing a query per article.
 */
interface EntityIndex {
  titles: string[];
  studios: string[];
  people: string[];
  loadedAt: number;
}

let entityIndex: EntityIndex | null = null;
const ENTITY_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Only reasonably distinctive names are indexed. One- and two-character titles
 * and generic words would match almost any headline and are skipped.
 */
function isDistinctive(name: string): boolean {
  const clean = name.trim();
  if (clean.length < 5) return false;
  const GENERIC = new Set([
    'news', 'movie', 'movies', 'anime', 'manga', 'game', 'games', 'trailer',
    'season', 'series', 'special', 'the movie', 'original', 'project',
  ]);
  return !GENERIC.has(clean.toLowerCase());
}

async function loadEntityIndex(): Promise<EntityIndex> {
  if (entityIndex && Date.now() - entityIndex.loadedAt < ENTITY_CACHE_TTL_MS) {
    return entityIndex;
  }

  const [titles, studios, people] = await Promise.all([
    prisma.animeTitle.findMany({ select: { title: true } }),
    prisma.studio.findMany({ select: { name: true } }),
    prisma.person.findMany({ select: { name: true } }),
  ]);

  entityIndex = {
    titles: titles.map((t) => t.title).filter(isDistinctive),
    studios: studios.map((s) => s.name).filter(isDistinctive),
    // Staff and voice actors carry a lot of anime news that never says
    // "anime" — interviews, casting, music releases. A full name is specific
    // enough to be a reliable signal; single names are not, so require two
    // parts to keep common words out of the index.
    people: people
      .map((p) => p.name)
      .filter((n) => isDistinctive(n) && n.trim().split(/\s+/).length >= 2),
    loadedAt: Date.now(),
  };
  return entityIndex;
}

/** Drops the cached catalog snapshot; used by the backfill script. */
export function resetEntityIndex(): void {
  entityIndex = null;
}

/**
 * Classifies one article. `text` should combine the title and summary.
 */
export async function classifyRelevance(
  title: string,
  summary?: string | null,
  options: {
    /**
     * True when the entity matcher resolved this article to a canonical Anime,
     * Studio or Person. That is a definitive anime signal and short-circuits
     * the heuristics — it is how a round-up like "Kirby and Metroid Games
     * Revealed, Tokyo Revengers Joins ..." stays in the feed despite carrying
     * off-topic keywords.
     */
    hasConfirmedEntityMatch?: boolean;
  } = {}
): Promise<RelevanceVerdict> {
  if (options.hasConfirmedEntityMatch) {
    return {
      relevance: 'ANIME_RELATED',
      score: 0.99,
      reason: 'Resolved to a canonical OTAKUVA entity by the entity matcher',
    };
  }

  const haystack = normalizeText(`${title || ''} ${summary || ''}`);

  if (!haystack.trim()) {
    return {
      relevance: 'REVIEW',
      score: 0.5,
      reason: 'No title or summary text to classify',
    };
  }

  // --- Strong signals: these settle it, whatever else the headline mentions.
  const strong: string[] = [];

  const animeTerm = firstMatch(ANIME_RE, haystack);
  if (animeTerm) strong.push(`anime term "${animeTerm}"`);

  const franchise = firstMatch(FRANCHISE_RE, haystack);
  if (franchise) strong.push(`anime-adjacent franchise "${franchise}"`);

  // Canonical catalog match ties the article to an entity OTAKUVA already
  // knows about (section 35), so it is the most trustworthy signal available.
  const index = await loadEntityIndex();
  const matchedTitle = index.titles.find((t) => containsEntity(haystack, t));
  if (matchedTitle) strong.push(`catalog anime "${matchedTitle}"`);

  const matchedStudio = index.studios.find((s) => containsEntity(haystack, s));
  if (matchedStudio) strong.push(`catalog studio "${matchedStudio}"`);

  const matchedPerson = index.people.find((p) => containsEntity(haystack, p));
  if (matchedPerson) strong.push(`catalog person "${matchedPerson}"`);

  if (strong.length > 0) {
    // More independent signals means more confidence, capped at 0.99 — this is
    // a heuristic, never a verified fact.
    const score = Math.min(0.99, 0.75 + 0.08 * strong.length);
    return {
      relevance: 'ANIME_RELATED',
      score: Number(score.toFixed(2)),
      reason: strong.join('; '),
    };
  }

  // --- No strong signal: an explicit off-topic subject now decides it.
  const offTopic = firstMatch(OFF_TOPIC_RE, haystack);
  if (offTopic) {
    return {
      relevance: 'OFF_TOPIC',
      score: 0.1,
      reason: `Off-topic subject "${offTopic}" with no anime signal`,
    };
  }

  // --- Weak signals only: keep it, but at lower confidence.
  const weak = firstMatch(WEAK_ANIME_RE, haystack);
  if (weak) {
    return {
      relevance: 'ANIME_RELATED',
      score: 0.6,
      reason: `Suggestive term "${weak}" and no off-topic subject`,
    };
  }

  return {
    relevance: 'REVIEW',
    score: 0.5,
    reason: 'No anime signal and no off-topic signal — needs an editor',
  };
}

/**
 * Prisma predicate for every public-facing news query. Hides OFF_TOPIC while
 * keeping REVIEW visible. Import this rather than re-writing the condition, so
 * the feed, trending, search and personalization can never drift apart.
 */
export const PUBLIC_RELEVANCE_WHERE = { not: 'OFF_TOPIC' } as const;

export const newsRelevanceService = {
  classifyRelevance,
  resetEntityIndex,
};
