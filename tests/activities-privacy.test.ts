import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createUser } from './helpers/fixtures';

import { GET as activitiesGET } from '../src/app/api/activities/route';

after(async () => {
  await prisma.$disconnect();
});

describe('GET /api/activities', () => {
  // This feed used to return every member's activity — including private
  // library status changes — to anyone, signed in or not.
  test('anonymous callers are refused', async () => {
    const res = await activitiesGET(request('GET', '/api/activities'));
    assert.equal(res.status, 401);
  });

  test('a signed-in user sees only their own activity', async () => {
    const me = await createUser();
    const someoneElse = await createUser();
    await prisma.activity.create({ data: { userId: me.id, type: 'STATUS_CHANGED' } });
    await prisma.activity.create({ data: { userId: someoneElse.id, type: 'STATUS_CHANGED' } });

    const { status, body } = await read(await activitiesGET(request('GET', '/api/activities?limit=50', { as: me })));
    assert.equal(status, 200);
    assert.ok(body.activities.length >= 1);
    assert.ok(body.activities.every((a: any) => a.user?.id === me.id), 'no other member’s activity is returned');
  });

  test('a junk limit falls back instead of erroring', async () => {
    const me = await createUser();
    const res = await activitiesGET(request('GET', '/api/activities?limit=abc', { as: me }));
    assert.equal(res.status, 200);
  });
});
