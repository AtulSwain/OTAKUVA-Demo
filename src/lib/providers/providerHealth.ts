/**
 * OTAKUVA — in-memory health/failover telemetry for anime data providers.
 *
 * Backs the admin-visible indicator at `/admin/data` (via
 * `GET /api/admin/data`): current health per adapter (anilist/jikan) and a
 * bounded log of recent failover events. Same pattern as
 * `providerMetrics` in src/lib/jikanService.ts and `PerformanceMetrics` —
 * process-local, resets on restart, not persisted. That's a deliberate
 * fit here: this is operational telemetry about "is the provider working
 * right now," not data that needs to survive a restart or be queried
 * historically — if that changes, promote it to a DB table (there's no
 * existing schema model for it, unlike DataSourceRecord/
 * AnimeMetadataHistory, which already exist and cover durable per-entity
 * provenance — see failoverProvider.ts for how those get written).
 */

export type ProviderName = 'anilist' | 'jikan';

export interface FailoverEvent {
  timestamp: string;
  method: string;
  externalId: string;
  fromProvider: ProviderName;
  toProvider: ProviderName;
  reason: 'error' | 'timeout' | 'incomplete';
  detail: string;
}

interface AdapterHealth {
  provider: ProviderName;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  incompleteCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
}

const MAX_FAILOVER_EVENTS = 200;

function freshHealth(provider: ProviderName): AdapterHealth {
  return {
    provider,
    totalCalls: 0,
    successCount: 0,
    failureCount: 0,
    timeoutCount: 0,
    incompleteCount: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,
  };
}

const health = new Map<ProviderName, AdapterHealth>([
  ['anilist', freshHealth('anilist')],
  ['jikan', freshHealth('jikan')],
]);

const failoverEvents: FailoverEvent[] = [];

function getOrInitHealth(provider: ProviderName): AdapterHealth {
  let entry = health.get(provider);
  if (!entry) {
    entry = freshHealth(provider);
    health.set(provider, entry);
  }
  return entry;
}

export function recordProviderSuccess(provider: ProviderName): void {
  const entry = getOrInitHealth(provider);
  entry.totalCalls++;
  entry.successCount++;
  entry.lastSuccessAt = new Date().toISOString();
}

export function recordProviderFailure(provider: ProviderName, kind: 'error' | 'timeout' | 'incomplete', error: string): void {
  const entry = getOrInitHealth(provider);
  entry.totalCalls++;
  entry.failureCount++;
  if (kind === 'timeout') entry.timeoutCount++;
  if (kind === 'incomplete') entry.incompleteCount++;
  entry.lastFailureAt = new Date().toISOString();
  entry.lastError = error;
}

export function recordFailoverEvent(event: Omit<FailoverEvent, 'timestamp'>): void {
  failoverEvents.unshift({ ...event, timestamp: new Date().toISOString() });
  if (failoverEvents.length > MAX_FAILOVER_EVENTS) failoverEvents.length = MAX_FAILOVER_EVENTS;
}

export interface ProviderHealthSnapshot {
  adapters: (AdapterHealth & {
    /** null when there aren't enough calls yet to mean anything. */
    successRate: number | null;
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  })[];
  recentFailoverEvents: FailoverEvent[];
}

/**
 * status is judged only over the adapter's most recent activity, not its
 * lifetime totals — an adapter that failed constantly an hour ago but has
 * been fine for the last 20 calls should read HEALTHY, not DOWN forever.
 * Cheap approximation of "recent" without a rolling window: compare
 * whichever of lastSuccessAt/lastFailureAt is more recent.
 */
function judgeStatus(entry: AdapterHealth): 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN' {
  if (entry.totalCalls === 0) return 'UNKNOWN';
  if (!entry.lastFailureAt) return 'HEALTHY';
  if (!entry.lastSuccessAt) return 'DOWN';
  return entry.lastSuccessAt > entry.lastFailureAt ? 'HEALTHY' : 'DEGRADED';
}

export function getProviderHealthSnapshot(): ProviderHealthSnapshot {
  return {
    adapters: [...health.values()].map((entry) => ({
      ...entry,
      successRate: entry.totalCalls > 0 ? parseFloat((entry.successCount / entry.totalCalls).toFixed(3)) : null,
      status: judgeStatus(entry),
    })),
    recentFailoverEvents: failoverEvents.slice(0, 50),
  };
}

/** Test-only reset — mirrors CacheManager.clearAll()'s pattern. */
export function _resetProviderHealthForTests(): void {
  health.set('anilist', freshHealth('anilist'));
  health.set('jikan', freshHealth('jikan'));
  failoverEvents.length = 0;
}
