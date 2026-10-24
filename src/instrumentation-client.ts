/**
 * OTAKUVA — Sentry init for the browser. Next.js (14.3+) auto-loads this
 * file (at src/instrumentation-client.ts, since this app uses a src/
 * directory) before any client code runs — no manual import needed
 * anywhere. See sentry.server.config.ts for the fuller explanation of the
 * shared settings.
 *
 * Uses NEXT_PUBLIC_SENTRY_DSN, not SENTRY_DSN — this file ships to the
 * browser, so only a `NEXT_PUBLIC_`-prefixed var is available here (the
 * DSN itself is meant to be public — it identifies where to send events,
 * it isn't a secret — but the plain SENTRY_DSN server var deliberately
 * isn't reused here to keep "what's in the client bundle" obvious at the
 * call site rather than implicit).
 */
import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './lib/observability/sentryScrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
