import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { signJwtToken } from '../src/lib/auth';
import { read, type TestUser } from './helpers/http';
import { createUser } from './helpers/fixtures';
import { hashToken } from '../src/lib/security/tokens';

import { POST as resetRequestPOST } from '../src/app/api/auth/password-reset/request/route';
import { POST as resetConfirmPOST } from '../src/app/api/auth/password-reset/confirm/route';
import { POST as loginPOST } from '../src/app/api/auth/login/route';

after(async () => {
  await prisma.$disconnect();
});

let ipCounter = 0;
/** A fresh x-forwarded-for per call by default, so unrelated tests never
 * collide in the IP rate limiter's bucket. Pass a fixed `ip` to
 * deliberately share a bucket (e.g. to test the limiter itself). */
function authRequest(method: string, path: string, opts: { as?: TestUser; body?: unknown; ip?: string } = {}) {
  const headers = new Headers();
  headers.set('x-forwarded-for', opts.ip || `10.0.0.${(ipCounter++ % 250) + 1}`);
  if (opts.as) {
    const token = signJwtToken({ userId: opts.as.id, username: opts.as.username, email: opts.as.email });
    headers.set('cookie', `anilog_token=${token}`);
  }
  if (opts.body !== undefined) headers.set('content-type', 'application/json');
  headers.set('origin', 'http://localhost:3000');
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe('password reset', () => {
  test('request stores only a hash of the token, never the raw value, with ~1h expiry', async () => {
    const user = await createUser();
    const res = await read(await resetRequestPOST(authRequest('POST', '/api/auth/password-reset/request', { body: { email: user.email } })));
    assert.equal(res.status, 200);

    const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    assert.equal(tokens.length, 1);
    const token = tokens[0];

    // Never plaintext: a random 64-hex-char raw token would never itself
    // look like a stored 64-hex-char SHA-256 digest by coincidence, but the
    // real point is there's no column holding a reversible/plain value at all.
    assert.equal(token.tokenHash.length, 64);
    assert.match(token.tokenHash, /^[0-9a-f]{64}$/);

    const ttlMs = token.expiresAt.getTime() - token.createdAt.getTime();
    assert.ok(Math.abs(ttlMs - 60 * 60 * 1000) < 5000, `expected ~1h TTL, got ${ttlMs}ms`);
    assert.equal(token.usedAt, null);
  });

  test('request for an unknown email responds identically and creates no token (no enumeration)', async () => {
    const known = await createUser();
    const knownRes = await read(await resetRequestPOST(authRequest('POST', '/api/auth/password-reset/request', { body: { email: known.email } })));
    const unknownRes = await read(await resetRequestPOST(authRequest('POST', '/api/auth/password-reset/request', { body: { email: 'nobody-here@test.invalid' } })));

    assert.equal(knownRes.status, 200);
    assert.equal(unknownRes.status, 200);
    assert.equal(knownRes.body.message, unknownRes.body.message);

    const orphanTokens = await prisma.passwordResetToken.findMany({ where: { user: { email: 'nobody-here@test.invalid' } } });
    assert.equal(orphanTokens.length, 0);
  });

  test('confirm accepts a valid token exactly once, then rejects the same token as used', async () => {
    // A legacy email/password account: once a phone is verified, password
    // sign-in is retired (see tests/phone-auth.test.ts).
    const user = await createUser('USER', { verified: false });
    await resetRequestPOST(authRequest('POST', '/api/auth/password-reset/request', { body: { email: user.email } }));
    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });

    // Recover the raw token the way the route generated it: we don't have
    // it (only its hash was persisted, by design), so drive this test via
    // a token we mint ourselves and store the matching hash directly —
    // proving the confirm route works off tokenHash lookups, not the ORM
    // object identity from the request above.
    const rawToken = 'a'.repeat(64);
    await prisma.passwordResetToken.update({ where: { id: stored.id }, data: { tokenHash: hashToken(rawToken) } });

    const first = await read(await resetConfirmPOST(authRequest('POST', '/api/auth/password-reset/confirm', { body: { token: rawToken, newPassword: 'new-password-123' } })));
    assert.equal(first.status, 200);

    // New password actually works.
    const loginRes = await read(await loginPOST(authRequest('POST', '/api/auth/login', { body: { identifier: user.email, password: 'new-password-123' } })));
    assert.equal(loginRes.status, 200);

    // Single-use: the same raw token is now rejected.
    const second = await read(await resetConfirmPOST(authRequest('POST', '/api/auth/password-reset/confirm', { body: { token: rawToken, newPassword: 'another-password-456' } })));
    assert.equal(second.status, 400);

    const afterUse = await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: stored.id } });
    assert.notEqual(afterUse.usedAt, null);
  });

  test('confirm rejects an expired token', async () => {
    const user = await createUser();
    const rawToken = 'b'.repeat(64);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    });

    const res = await read(await resetConfirmPOST(authRequest('POST', '/api/auth/password-reset/confirm', { body: { token: rawToken, newPassword: 'whatever-123' } })));
    assert.equal(res.status, 400);
  });

  test('confirm rejects an unknown token', async () => {
    const res = await read(await resetConfirmPOST(authRequest('POST', '/api/auth/password-reset/confirm', { body: { token: 'c'.repeat(64), newPassword: 'whatever-123' } })));
    assert.equal(res.status, 400);
  });

  test('IP limiter blocks after 10 requests from the same IP, with a Retry-After header', async () => {
    const ip = '203.0.113.5';
    let lastRes: Response | null = null;
    for (let i = 0; i < 11; i++) {
      lastRes = await resetRequestPOST(authRequest('POST', '/api/auth/password-reset/request', { ip, body: { email: `flood-${i}@test.invalid` } }));
    }
    assert.equal(lastRes!.status, 429);
    assert.ok(lastRes!.headers.get('Retry-After'));
  });
});
