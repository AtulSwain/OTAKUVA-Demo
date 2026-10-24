/**
 * OTAKUVA — structured logger.
 *
 * Replaces ad-hoc `console.log`/`console.error`/`console.warn` calls
 * across `src/app/api/**` and `src/lib/**` (a migration in progress — see
 * CLAUDE.md's Phase 10 backlog for what's converted so far and what
 * isn't). Every call emits one JSON line to stdout/stderr (structured,
 * not string-concatenated — grep/parse-friendly for whatever log
 * aggregator ends up reading production output) carrying:
 *   - level: 'debug' | 'info' | 'warn' | 'error'
 *   - msg: the human-readable message
 *   - time: ISO timestamp
 *   - route/method/status/latencyMs: request context, when applicable
 *     (set once per request via withRequestContext()/child(), not passed
 *     to every call — see below)
 *   - userId: attached the same way, when authenticated (never email/
 *     username/role — matches Sentry's user context, see
 *     src/lib/observability/sentryUser.ts)
 *   - err: normalized {name, message, stack} for an Error passed as
 *     context.error — never a raw Error object (util.inspect on a raw
 *     Error can pull in unexpected enumerable properties)
 *   - ...whatever else is passed in `context`, minus known-sensitive keys
 *     (redacted the same way as src/lib/observability/sentryScrub.ts —
 *     see SENSITIVE_KEY_PATTERN below, kept in sync manually since the
 *     two modules serve different runtimes/targets and shouldn't import
 *     each other for one shared regex).
 *
 * `error`/`warn` also forward to Sentry (Sentry.captureException for an
 * Error in context.error, Sentry.captureMessage otherwise) so a `logger.
 * error(...)` call site that isn't inside a try/catch Sentry would
 * otherwise see still reaches error tracking — call sites don't need to
 * remember to do both.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.error('Failed to sync anime from provider', { error: err, animeId, provider });
 *   logger.info('Catalog sync completed', { processed, created, updated });
 *
 *   // Request-scoped (route, method, status, latencyMs, userId on every
 *   // line without repeating them) — see src/lib/api/apiHandler.ts for
 *   // where this is wired in automatically for routes using withApiHandler:
 *   const log = logger.child({ route: '/api/anime/[id]', method: 'GET' });
 *   log.info('cache miss, fetching from DB');
 *   log.withStatus(200).withLatency(42).info('request completed');
 */

import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
  error?: unknown;
  /** Forwarded to Sentry.captureException/captureMessage's `tags` — searchable/filterable fields, unlike `extra`. Only meaningful when the call reaches Sentry (error level, or warn with toSentry: true — see below). */
  tags?: Record<string, string | number | boolean>;
  /**
   * warn() only reaches Sentry when this is explicitly true. Most warn()
   * call sites are routine, expected, already-handled conditions (a retry
   * after a 429, a skipped/unmatched record) that fire often enough —
   * sometimes thousands of times during one degraded-provider run, see
   * CLAUDE.md's Jikan-degradation notes — that reporting every one to
   * Sentry would drown real signal and burn quota for noise. error() has
   * no such opt-out: an unhandled/unexpected failure always reaches it.
   */
  toSentry?: boolean;
}

const SENSITIVE_KEY_PATTERN =
  /(password|passwordhash|token|secret|apikey|api_key|authorization|auth_secret|cookie|credential|private_?key|access_?key|jwt|dsn)/i;

const MAX_REDACT_DEPTH = 6;

function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACT_DEPTH || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return value; // handled separately, see normalizeError
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

function normalizeError(err: unknown): { name: string; message: string; stack?: string } | undefined {
  if (err === undefined) return undefined;
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: 'NonErrorThrown', message: typeof err === 'string' ? err : JSON.stringify(err) };
}

function write(level: LogLevel, msg: string, context: LogContext = {}, base: Record<string, unknown> = {}): void {
  const { error, tags, toSentry, ...rest } = context;
  const normalizedError = normalizeError(error);
  const redactedExtra = redact({ ...base, ...rest }, 0) as Record<string, unknown>;

  const line = {
    level,
    msg,
    time: new Date().toISOString(),
    ...redactedExtra,
    ...(normalizedError ? { err: normalizedError } : {}),
  };

  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);

  // error() always reaches Sentry; warn() only when the call site opts in
  // with toSentry: true (see LogContext.toSentry's doc comment on why
  // warn defaults to local-only). This is the single place either
  // reaches Sentry from — call sites (and withApiHandler, for the
  // unhandled-error path) rely on this rather than also calling
  // Sentry.captureException themselves, so nothing is ever reported twice.
  const shouldReachSentry = level === 'error' || (level === 'warn' && toSentry === true);
  if (shouldReachSentry) {
    const sentryLevel = level === 'error' ? 'error' : 'warning';
    if (error instanceof Error) {
      Sentry.captureException(error, { tags, extra: redactedExtra, level: sentryLevel });
    } else {
      Sentry.captureMessage(msg, { tags, extra: redactedExtra, level: sentryLevel });
    }
  }
}

export interface Logger {
  debug(msg: string, context?: LogContext): void;
  info(msg: string, context?: LogContext): void;
  warn(msg: string, context?: LogContext): void;
  error(msg: string, context?: LogContext): void;
  /** Returns a logger with `base` fields merged into every subsequent line — route/method context that would otherwise repeat on every call. */
  child(base: Record<string, unknown>): Logger;
  /** Convenience for request-scoped loggers: returns a child with `status` added. */
  withStatus(status: number): Logger;
  /** Convenience for request-scoped loggers: returns a child with `latencyMs` added. */
  withLatency(latencyMs: number): Logger;
}

function createLogger(base: Record<string, unknown>): Logger {
  return {
    debug: (msg, context) => {
      if (process.env.NODE_ENV !== 'production') write('debug', msg, context, base);
    },
    info: (msg, context) => write('info', msg, context, base),
    warn: (msg, context) => write('warn', msg, context, base),
    error: (msg, context) => write('error', msg, context, base),
    child: (extra) => createLogger({ ...base, ...extra }),
    withStatus: (status) => createLogger({ ...base, status }),
    withLatency: (latencyMs) => createLogger({ ...base, latencyMs }),
  };
}

export const logger: Logger = createLogger({});
