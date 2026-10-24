/**
 * OTAKUVA — shared Sentry event scrubbing.
 *
 * Used by sentry.server.config.ts, sentry.edge.config.ts, and
 * src/instrumentation-client.ts as their `beforeSend`/`beforeSendTransaction`
 * hook. Defense in depth on top of `sendDefaultPii: false` (set explicitly
 * in every config, not relied on as an SDK default) — even with PII
 * collection off, an application error can still carry a secret into
 * `error.message`, a caught object's fields, breadcrumb data, or request
 * headers if a caller wasn't careful. This walks every event Sentry is
 * about to send and redacts anything under a key that looks sensitive,
 * everywhere in the payload, rather than trusting call sites to never
 * pass one through. Matches CLAUDE.md's rule: never log secrets, never
 * expose a full secret, never trust — here, never *transmit* — anything
 * that looks like one.
 */

import type { Event, EventHint } from '@sentry/nextjs';

const SENSITIVE_KEY_PATTERN =
  /(password|passwordhash|token|secret|apikey|api_key|authorization|auth_secret|cookie|credential|private_?key|access_?key|jwt|dsn)/i;

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH || value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : scrubValue(val, depth + 1);
    }
    return out;
  }

  return value;
}

function scrubHeaders(headers: unknown): unknown {
  if (!headers || typeof headers !== 'object') return headers;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(headers as Record<string, unknown>)) {
    out[key] = /^(authorization|cookie|set-cookie|x-api-key)$/i.test(key) ? REDACTED : val;
  }
  return out;
}

/**
 * beforeSend / beforeSendTransaction hook — pass to Sentry.init in every
 * runtime's config. Generic over Sentry's specific event subtypes
 * (ErrorEvent for beforeSend, TransactionEvent for beforeSendTransaction)
 * rather than typed to the general `Event` union, so it satisfies both
 * options' distinct expected signatures from one implementation.
 */
export function scrubSentryEvent<E extends Event>(event: E, _hint?: EventHint): E {
  if (event.request) {
    event.request = {
      ...event.request,
      headers: scrubHeaders(event.request.headers) as Record<string, string> | undefined,
      cookies: event.request.cookies ? (REDACTED as any) : event.request.cookies,
      data: scrubValue(event.request.data, 0) as any,
    };
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra, 0) as typeof event.extra;
  }

  if (event.contexts) {
    event.contexts = scrubValue(event.contexts, 0) as typeof event.contexts;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      data: crumb.data ? (scrubValue(crumb.data, 0) as typeof crumb.data) : crumb.data,
    }));
  }

  // Sentry.setUser() should only ever be given { id } in this codebase
  // (see src/lib/observability/sentryUser.ts) — this is a last-resort
  // guard in case something upstream ever attaches more.
  if (event.user) {
    const { id } = event.user;
    event.user = id ? { id } : undefined;
  }

  return event;
}
