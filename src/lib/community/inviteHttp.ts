import { NextResponse } from 'next/server';
import { logger } from '../logger';
import { InviteError } from './invitations';

/** Consistent JSON errors for the invitation routes; never echoes a key. */
export function inviteErrorResponse(err: unknown, what: string) {
  if (err instanceof InviteError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: { 'Cache-Control': 'no-store' } });
  }
  logger.error(`Failed to ${what}`, { component: 'invitations', err });
  return NextResponse.json({ error: `Couldn't ${what}. Try again.` }, { status: 500 });
}
