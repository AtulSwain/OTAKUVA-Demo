import { NextResponse } from 'next/server';
import { logger } from '../logger';
import { CreatorError } from './creatorService';

export const NO_STORE = { 'Cache-Control': 'no-store' };

/** Consistent JSON errors for /api/creator/**. Private data — never cached. */
export function creatorErrorResponse(err: unknown, what: string) {
  if (err instanceof CreatorError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: NO_STORE });
  }
  const message = err instanceof Error ? err.message : '';
  // Validation errors from the shared rating service.
  if (message.startsWith('Rating must') || message.startsWith('Invalid category score')) {
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE });
  }
  logger.error(`Failed to ${what}`, { component: 'creator', err });
  return NextResponse.json({ error: `Could not ${what}. Try again.` }, { status: 500, headers: NO_STORE });
}
