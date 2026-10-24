/**
 * OTAKUVA — attaches the authenticated user id (only the id — never
 * email/username/role) to the current Sentry scope for a request.
 *
 * Deliberately does NOT call getAuthUserFromRequest() (which does a DB
 * lookup to re-read the user's current role): this runs on every request
 * through withApiHandler, including ones that don't otherwise need auth,
 * so it stays to a local JWT verify (no DB round trip) via
 * getUserIdFromRequestFast() in src/lib/auth.ts.
 */
import type { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getUserIdFromRequestFast } from '../auth';

export function attachSentryUser(request: NextRequest): void {
  const userId = getUserIdFromRequestFast(request);
  Sentry.setUser(userId ? { id: userId } : null);
}
