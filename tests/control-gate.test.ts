import './helpers/setupTestDb';

import { after, afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { signJwtToken, signPhonePass } from '../src/lib/auth';
import { read, request } from './helpers/http';
import { createUser } from './helpers/fixtures';
import { POST as loginPOST } from '../src/app/api/auth/login/route';
import { GET as overviewGET } from '../src/app/api/control/overview/route';
import { CONTROL_GATE_COOKIE, isControlGateKey } from '../Control Center/lib/gate';

// A test-only key; the owner's real key lives only as a hash in the server env.
const KEY = 'test-gate-key-000';

after(async () => {
  await prisma.$disconnect();
});

beforeEach(() => {
  process.env.CONTROL_GATE_KEY_SHA256 = createHash('sha256').update(KEY).digest('hex');
});
afterEach(() => {
  process.env.CONTROL_GATE_KEY_SHA256 = '';
});

function overviewWith(cookies: string[]) {
  return new NextRequest(new URL('/api/control/overview', 'http://localhost:3000'), {
    method: 'GET',
    headers: { cookie: cookies.join('; '), origin: 'http://localhost:3000' },
  });
}

describe('control-center key gate', () => {
  test('only the configured key matches', () => {
    assert.equal(isControlGateKey(KEY), true);
    assert.equal(isControlGateKey('wrong'), false);
    assert.equal(isControlGateKey(''), false);
    assert.equal(isControlGateKey(undefined), false);
    process.env.CONTROL_GATE_KEY_SHA256 = '';
    assert.equal(isControlGateKey(KEY), false, 'no hash configured → nothing matches');
  });

  test('the key in the password box sets the gate cookie and signs nobody in', async () => {
    const res = await loginPOST(request('POST', '/api/auth/login', { body: { identifier: 'anyone', password: KEY } }));
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(body, { gate: true, redirect: '/control' });
    const setCookie = res.headers.get('set-cookie') || '';
    assert.match(setCookie, new RegExp(`${CONTROL_GATE_COOKIE}=`));
    assert.match(setCookie, /HttpOnly/i);
    assert.doesNotMatch(setCookie, /anilog_token=/, 'the key must not create a session');
  });

  test('a wrong password is an ordinary failed sign-in', async () => {
    const res = await read(await loginPOST(request('POST', '/api/auth/login', { body: { identifier: 'nobody_here', password: 'nope1234' } })));
    assert.equal(res.status, 401);
    assert.equal(res.body.gate, undefined);
  });

  test('control routes need the gate AND an admin session', async () => {
    const admin = await createUser('ADMIN');
    const session = `anilog_token=${signJwtToken({ userId: admin.id, username: admin.username, email: admin.email })}`;

    // Admin session but no gate → 404 (the console stays hidden).
    assert.equal((await overviewGET(overviewWith([session]))).status, 404);

    const gateRes = await loginPOST(request('POST', '/api/auth/login', { body: { identifier: 'x', password: KEY } }));
    const gateCookie = (gateRes.headers.get('set-cookie') || '').split(';')[0];

    // Gate but no session → 401; gate + member → 403; gate + admin → 200.
    assert.equal((await overviewGET(overviewWith([gateCookie]))).status, 401);
    const member = await createUser('USER');
    const memberSession = `anilog_token=${signJwtToken({ userId: member.id, username: member.username, email: member.email })}`;
    assert.equal((await overviewGET(overviewWith([gateCookie, memberSession]))).status, 403);
    assert.equal((await overviewGET(overviewWith([gateCookie, session]))).status, 200);

    // Some other signed token (here a phone pass) is not a gate pass.
    const fake = `${CONTROL_GATE_COOKIE}=${signPhonePass('+910000000000', 'register')}`;
    assert.equal((await overviewGET(overviewWith([fake, session]))).status, 404);
  });
});
