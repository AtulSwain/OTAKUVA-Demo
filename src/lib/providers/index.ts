import { AnimeProvider } from './animeProvider.interface';
import { anilistProvider } from './anilistProvider';
import { JikanProvider, jikanProvider } from './jikanProvider';
import { createFailoverProvider, FailoverAnimeDataProvider } from './failoverProvider';

const PREFERRED = (process.env.ANILOG_PROVIDER || process.env.PREFERRED_PROVIDER || 'anilist').toLowerCase();

export { anilistProvider, JikanProvider, jikanProvider };
export { createFailoverProvider, getProviderTimeoutMs, DEFAULT_PROVIDER_TIMEOUT_MS } from './failoverProvider';
export type { FailoverAnimeDataProvider } from './failoverProvider';
export { getProviderHealthSnapshot } from './providerHealth';

/** Every registered anime-data adapter, in no particular order — failover chains are built from this. */
const REGISTRY: AnimeProvider[] = [anilistProvider, jikanProvider];

const failoverInstances = new Map<string, FailoverAnimeDataProvider>();

/**
 * Returns a failover-wrapped provider for `primaryName` (falling back, in
 * registration order, to every other adapter in REGISTRY) — cached per
 * primary name, since the wrapper itself is stateless aside from the
 * shared process-wide health telemetry in providerHealth.ts.
 *
 * This is what src/lib/syncEngine.ts's `getProvider()` calls instead of
 * looking up a raw adapter directly, so every sync method (ingestAnime,
 * syncEpisodes, syncCharacters, syncStaff, syncRelations) gets automatic
 * failover to whichever other adapter is registered, without changing how
 * any of them are called — see syncEngine.ts and
 * src/lib/providers/failoverProvider.ts's header comment for the full
 * design (what triggers failover, and how provenance is recorded).
 */
export function getFailoverProvider(primaryName: 'anilist' | 'jikan' = PREFERRED as 'anilist' | 'jikan'): FailoverAnimeDataProvider {
  const cached = failoverInstances.get(primaryName);
  if (cached) return cached;

  const primary = REGISTRY.find((p) => p.name === primaryName) || anilistProvider;
  const fallbacks = REGISTRY.filter((p) => p.name !== primary.name);
  const wrapped = createFailoverProvider(primary, fallbacks);
  failoverInstances.set(primaryName, wrapped);
  return wrapped;
}

/**
 * The app-wide default anime data provider — failover-wrapped, primary
 * chosen by ANILOG_PROVIDER/PREFERRED_PROVIDER (defaults to 'anilist').
 * Behaves exactly like a plain `AnimeProvider` for every existing
 * consumer (src/app/api/upcoming/route.ts,
 * src/lib/engine/anime/animeCatalogEngine.ts) — same call shape, same
 * return shape for the interface's own methods — the failover/provenance
 * behavior is additive, not a breaking change to this export's contract.
 */
export const defaultAnimeProvider: AnimeProvider = getFailoverProvider(PREFERRED as 'anilist' | 'jikan');
