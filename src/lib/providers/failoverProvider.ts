/**
 * OTAKUVA — provider failover.
 *
 * Wraps an ordered list of `AnimeDataProvider` adapters (a primary plus
 * one or more fallbacks) so a caller going through the wrapper never sees
 * a single adapter's outage/timeout/incomplete response as long as
 * another registered adapter can serve the same entity. Used to build
 * `defaultAnimeProvider` in src/lib/providers/index.ts, and by
 * src/lib/syncEngine.ts's `getProvider()` (so every sync method —
 * ingestAnime, syncEpisodes, syncCharacters, syncStaff, syncRelations —
 * gets this automatically without changing how they're called).
 *
 * Failover triggers on exactly three conditions, matching the ask:
 *   1. the call throws,
 *   2. the call doesn't settle within getProviderTimeoutMs() (a genuine hang
 *      — anilistProvider.ts's fetch() has no AbortController of its own,
 *      unlike jikanService.ts's 15s-per-attempt timeout, so this is the
 *      only backstop against AniList hanging forever),
 *   3. for the methods a "full" entity fetch is expected to populate
 *      (getAnimeEpisodes/getAnimeCharacters/getAnimeStaff), the result
 *      comes back as an empty array. Not applied to getAnimeRelations —
 *      most standalone anime genuinely have zero relations, so treating
 *      that as a failure would trigger a wasted extra provider call on
 *      the common, correct case; getAnime is checked separately (see
 *      isIncompleteAnime()) against the specific fields a full record
 *      needs, not just "is it null."
 *
 * Every attempt (success or failure) is recorded to
 * src/lib/providers/providerHealth.ts for the admin `/admin/data`
 * indicator. This module never writes DataSourceRecord/
 * AnimeMetadataHistory itself — it doesn't know the canonical DB entity
 * id yet, only the provider's externalId. Provenance is the ingesting
 * caller's job (syncEngine.ts), using this module's return value's
 * `.provider` field (or, for getAnime, `ProviderAnime.externalSource`,
 * which already encodes it) to know which adapter actually supplied the
 * data it's about to write.
 */

import type {
  AnimeDataProvider,
  ProviderAnime,
  ProviderPagination,
  ProviderEpisode,
  ProviderCharacter,
  ProviderStaff,
  ProviderRelation,
} from './animeProvider.interface';
import { recordProviderSuccess, recordProviderFailure, recordFailoverEvent } from './providerHealth';
import type { ProviderName } from './providerHealth';
import { logger } from '../logger';

export const DEFAULT_PROVIDER_TIMEOUT_MS = 20_000;

// Read lazily (not cached at module load) so tests can override
// PROVIDER_FAILOVER_TIMEOUT_MS in-process without needing to control
// import order — see tests/provider-failover.test.ts. Production behavior
// is identical either way: the env var doesn't change after startup.
export function getProviderTimeoutMs(): number {
  return parseInt(process.env.PROVIDER_FAILOVER_TIMEOUT_MS || '', 10) || DEFAULT_PROVIDER_TIMEOUT_MS;
}

class ProviderTimeoutError extends Error {
  constructor(provider: string, method: string, timeoutMs: number) {
    super(`${provider}.${method} timed out after ${timeoutMs}ms`);
    this.name = 'ProviderTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, provider: string, method: string): Promise<T> {
  const timeoutMs = getProviderTimeoutMs();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProviderTimeoutError(provider, method, timeoutMs)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Methods whose result is checked for "empty when it shouldn't be" as an
// additional failover trigger, beyond throw/timeout — see the header
// comment on why getAnimeRelations is deliberately excluded.
type EmptyCheckedMethod = 'getAnimeEpisodes' | 'getAnimeCharacters' | 'getAnimeStaff';

function isEmptyArrayResult(method: EmptyCheckedMethod, result: unknown): boolean {
  if (method === 'getAnimeEpisodes') {
    const r = result as { episodes: unknown[] } | undefined;
    return !r || r.episodes.length === 0;
  }
  return Array.isArray(result) && result.length === 0;
}

/**
 * A full anime record is expected to have at least a title and a
 * synopsis — the two fields every provider's `full`/detail endpoint
 * populates unconditionally when it has the entity at all. Missing
 * either is a much stronger "this response is broken" signal than "some
 * optional field is null," which is normal for plenty of real anime.
 */
function isIncompleteAnime(anime: ProviderAnime | null): boolean {
  if (!anime) return true;
  return !anime.title?.trim() || !anime.synopsis?.trim();
}

export interface WithProvider {
  /** Which adapter actually produced this result — may differ from the primary if failover occurred. */
  provider: ProviderName;
}

export interface FailoverAnimeDataProvider extends AnimeDataProvider {
  getAnimeEpisodes(externalId: string, page?: number): Promise<{ episodes: ProviderEpisode[]; pagination: ProviderPagination } & WithProvider>;
  getAnimeCharacters(externalId: string): Promise<ProviderCharacter[] & WithProvider>;
  getAnimeStaff(externalId: string): Promise<ProviderStaff[] & WithProvider>;
  getAnimeRelations(externalId: string): Promise<ProviderRelation[] & WithProvider>;
}

/**
 * Attaches a non-enumerable `provider` field to an array result so
 * `Array.isArray()`/spreading/JSON-serializing it elsewhere behaves
 * exactly like a plain array (no stray extra element, no visible extra
 * key in `Object.keys`) while still letting a caller that knows to look
 * read `.provider` off it.
 */
function tagArray<T extends unknown[]>(arr: T, provider: ProviderName): T & WithProvider {
  Object.defineProperty(arr, 'provider', { value: provider, enumerable: false, configurable: true });
  return arr as T & WithProvider;
}

export function createFailoverProvider(primary: AnimeDataProvider, fallbacks: AnimeDataProvider[]): FailoverAnimeDataProvider {
  const chain = [primary, ...fallbacks];

  /**
   * Runs `call(adapter)` against each adapter in the chain in order,
   * stopping at the first one that succeeds AND (if `isIncomplete` is
   * given) isn't incomplete. Every non-final failure is recorded as a
   * failover event; the final adapter's failure/incompleteness is
   * allowed through as this function's own outcome (thrown, or the
   * incomplete result returned as-is) — failover never fabricates data
   * to paper over every adapter being down or genuinely not having the
   * entity, it only ever prefers a *better* real result over a worse one.
   */
  async function withFailover<T>(
    methodName: string,
    externalId: string,
    call: (adapter: AnimeDataProvider) => Promise<T>,
    isIncomplete?: (result: T) => boolean
  ): Promise<{ result: T; provider: ProviderName }> {
    let lastError: unknown;
    let lastIncompleteResult: { result: T; provider: ProviderName } | undefined;

    for (let i = 0; i < chain.length; i++) {
      const adapter = chain[i];
      const isLast = i === chain.length - 1;

      try {
        const result = await withTimeout(call(adapter), adapter.name, methodName);
        const incomplete = isIncomplete?.(result) ?? false;

        if (!incomplete) {
          recordProviderSuccess(adapter.name);
          if (i > 0) {
            logger.info('provider failover recovered', { method: methodName, externalId, servedBy: adapter.name, skipped: chain.slice(0, i).map((p) => p.name) });
          }
          return { result, provider: adapter.name };
        }

        recordProviderFailure(adapter.name, 'incomplete', `${methodName} returned an incomplete result`);
        lastIncompleteResult = { result, provider: adapter.name };

        if (!isLast) {
          const next = chain[i + 1];
          recordFailoverEvent({ method: methodName, externalId, fromProvider: adapter.name, toProvider: next.name, reason: 'incomplete', detail: 'empty/incomplete result' });
        }
      } catch (err) {
        const isTimeout = err instanceof ProviderTimeoutError;
        const message = err instanceof Error ? err.message : String(err);
        recordProviderFailure(adapter.name, isTimeout ? 'timeout' : 'error', message);
        lastError = err;

        if (!isLast) {
          const next = chain[i + 1];
          recordFailoverEvent({ method: methodName, externalId, fromProvider: adapter.name, toProvider: next.name, reason: isTimeout ? 'timeout' : 'error', detail: message });
          logger.warn('provider call failed, failing over', { method: methodName, externalId, from: adapter.name, to: next.name, reason: isTimeout ? 'timeout' : 'error', error: err });
        }
      }
    }

    // Every adapter either threw or came back incomplete. Prefer a real
    // (if incomplete) result over throwing — missing stays missing, never
    // fabricated, but an incomplete-but-real response is still more
    // useful to the caller than nothing. Only throw if not even that
    // exists.
    if (lastIncompleteResult) return lastIncompleteResult;
    throw lastError;
  }

  return {
    name: primary.name,

    async searchAnime(query, page, limit) {
      const { result } = await withFailover('searchAnime', query, (a) => a.searchAnime(query, page, limit));
      return result;
    },

    async getAnime(externalId) {
      // No extra provider tag needed here: ProviderAnime.externalSource
      // already tells the caller which adapter's data shape this is
      // ('anilist' or 'mal' — jikanProvider always sets 'mal').
      const { result } = await withFailover('getAnime', externalId, (a) => a.getAnime(externalId), isIncompleteAnime);
      return result;
    },

    async getAnimeList(page, limit) {
      const { result } = await withFailover('getAnimeList', `page:${page ?? 1}`, (a) => a.getAnimeList(page, limit));
      return result;
    },

    async getAnimeEpisodes(externalId, page) {
      const { result, provider } = await withFailover(
        'getAnimeEpisodes',
        externalId,
        (a) => a.getAnimeEpisodes(externalId, page),
        (r) => isEmptyArrayResult('getAnimeEpisodes', r)
      );
      return { ...result, provider };
    },

    async getAnimeCharacters(externalId) {
      const { result, provider } = await withFailover(
        'getAnimeCharacters',
        externalId,
        (a) => a.getAnimeCharacters(externalId),
        (r) => isEmptyArrayResult('getAnimeCharacters', r)
      );
      return tagArray(result, provider);
    },

    async getAnimeStaff(externalId) {
      const { result, provider } = await withFailover(
        'getAnimeStaff',
        externalId,
        (a) => a.getAnimeStaff(externalId),
        (r) => isEmptyArrayResult('getAnimeStaff', r)
      );
      return tagArray(result, provider);
    },

    async getAnimeRelations(externalId) {
      const { result, provider } = await withFailover('getAnimeRelations', externalId, (a) => a.getAnimeRelations(externalId));
      return tagArray(result, provider);
    },

    async getAnimeVideos(externalId) {
      const { result } = await withFailover('getAnimeVideos', externalId, (a) => {
        if (!a.getAnimeVideos) throw new Error(`${a.name} does not implement getAnimeVideos`);
        return a.getAnimeVideos(externalId);
      });
      return result;
    },

    async getAnimePictures(externalId) {
      const { result } = await withFailover('getAnimePictures', externalId, (a) => {
        if (!a.getAnimePictures) throw new Error(`${a.name} does not implement getAnimePictures`);
        return a.getAnimePictures(externalId);
      });
      return result;
    },

    async getAnimeNews(externalId) {
      const { result } = await withFailover('getAnimeNews', externalId, (a) => {
        if (!a.getAnimeNews) throw new Error(`${a.name} does not implement getAnimeNews`);
        return a.getAnimeNews(externalId);
      });
      return result;
    },

    async getAnimeRecommendations(externalId) {
      const { result } = await withFailover('getAnimeRecommendations', externalId, (a) => {
        if (!a.getAnimeRecommendations) throw new Error(`${a.name} does not implement getAnimeRecommendations`);
        return a.getAnimeRecommendations(externalId);
      });
      return result;
    },

    async getAnimeReviews(externalId, page) {
      const { result } = await withFailover('getAnimeReviews', externalId, (a) => {
        if (!a.getAnimeReviews) throw new Error(`${a.name} does not implement getAnimeReviews`);
        return a.getAnimeReviews(externalId, page);
      });
      return result;
    },

    async getAnimeStreaming(externalId) {
      const { result } = await withFailover('getAnimeStreaming', externalId, (a) => {
        if (!a.getAnimeStreaming) throw new Error(`${a.name} does not implement getAnimeStreaming`);
        return a.getAnimeStreaming(externalId);
      });
      return result;
    },

    async getAnimeStatistics(externalId) {
      const { result } = await withFailover('getAnimeStatistics', externalId, (a) => {
        if (!a.getAnimeStatistics) throw new Error(`${a.name} does not implement getAnimeStatistics`);
        return a.getAnimeStatistics(externalId);
      });
      return result;
    },

    async getTopAnime(page, limit) {
      const { result } = await withFailover('getTopAnime', `page:${page ?? 1}`, (a) => a.getTopAnime(page, limit));
      return result;
    },

    async getSeasonalAnime(year, season, page, limit) {
      const { result } = await withFailover('getSeasonalAnime', `${year}-${season}`, (a) => a.getSeasonalAnime(year, season, page, limit));
      return result;
    },

    async getUpcomingAnime(page, limit) {
      const { result } = await withFailover('getUpcomingAnime', `page:${page ?? 1}`, (a) => a.getUpcomingAnime(page, limit));
      return result;
    },

    async getHistoricalAnime(startYear, endYear, page, limit) {
      const { result } = await withFailover('getHistoricalAnime', `${startYear}-${endYear}`, (a) => a.getHistoricalAnime(startYear, endYear, page, limit));
      return result;
    },
  };
}
