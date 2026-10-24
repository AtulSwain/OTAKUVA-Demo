import { NextRequest } from 'next/server';
import { signJwtToken } from '../../src/lib/auth';

export interface TestUser {
  id: string;
  username: string;
  email: string;
}

interface RequestOptions {
  /** Signs a real session cookie for this user, as the browser would send. */
  as?: TestUser;
  body?: unknown;
}

const BASE_URL = 'http://localhost:3000';

export function request(method: string, path: string, { as, body }: RequestOptions = {}): NextRequest {
  const headers = new Headers();
  if (as) {
    const token = signJwtToken({ userId: as.id, username: as.username, email: as.email });
    headers.set('cookie', `anilog_token=${token}`);
  }
  if (body !== undefined) headers.set('content-type', 'application/json');
  // A real browser sends Origin on same-origin fetch/form submissions too,
  // not just cross-origin ones — matches it here so cookie-authenticated
  // mutating requests pass the CSRF origin check in src/lib/auth.ts the
  // same way a legitimate same-origin request would.
  headers.set('origin', BASE_URL);
  return new NextRequest(new URL(path, BASE_URL), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function read(res: Response): Promise<{ status: number; body: any }> {
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}
