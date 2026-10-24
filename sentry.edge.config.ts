/**
 * OTAKUVA — Sentry init for the Edge runtime (src/middleware.ts, any
 * route handler that opts into `export const runtime = 'edge'`). Loaded
 * by src/instrumentation.ts's register() when NEXT_RUNTIME === 'edge'.
 * See sentry.server.config.ts for the fuller explanation — same settings,
 * duplicated rather than shared because the two run in genuinely
 * different bundles/runtimes (Edge can't import Node-only code).
 */
import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './src/lib/observability/sentryScrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
});
