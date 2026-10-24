/**
 * OTAKUVA — Next.js server instrumentation entry point.
 *
 * register() runs once per server/edge runtime instance at process
 * startup — this is what actually loads Sentry's init (see
 * ../sentry.server.config.ts / ../sentry.edge.config.ts), conditioned on
 * which runtime is starting up. Requires
 * `experimental.instrumentationHook: true` in next.config.mjs on
 * Next.js 14.x (stable/default from 15 on — leave the flag in place
 * either way, it's a no-op once default-enabled).
 *
 * onRequestError is Next.js's hook for errors thrown anywhere in a
 * server request — route handlers, RSC render, middleware — including
 * ones that never reach an application-level try/catch (so this is the
 * backstop for "unhandled exceptions", complementing withApiHandler's
 * explicit capture for routes that use it — see src/lib/api/apiHandler.ts).
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
