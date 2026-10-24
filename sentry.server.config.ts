/**
 * OTAKUVA — Sentry init for the Node.js server runtime (API routes, RSC,
 * route handlers). Loaded by src/instrumentation.ts's register() when
 * NEXT_RUNTIME === 'nodejs'. See docs/production/RUNBOOK.md's
 * "Error tracking (Sentry)" section for setup / env vars.
 *
 * No-op when SENTRY_DSN is unset (`enabled` below) — Sentry is optional
 * infrastructure, never a hard dependency: an unconfigured/unreachable
 * Sentry must never affect request handling.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './src/lib/observability/sentryScrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

  // Never attach IP addresses, cookies, or request bodies by default —
  // scrubSentryEvent() below is a second layer on top of this, not a
  // substitute for it.
  sendDefaultPii: false,

  // Performance tracing: low sample rate in production (cost control),
  // off in dev/test (noise control) — errors are always captured
  // regardless of this, sampling only affects performance transactions.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
});
