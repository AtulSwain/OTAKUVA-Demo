import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createUser } from './helpers/fixtures';

import { GET as recommendationsGET } from '../src/app/api/recommendations/route';

after(async () => {
  await prisma.$disconnect();
});

describe('GET /api/recommendations', () => {
  // Guests were passed through as the placeholder id 'guest_user'; the taste
  // engine then upserted a UserTasteProfile for it, violating the User foreign
  // key, so every anonymous request returned 500.
  test('anonymous visitors get a 200 and no taste profile is stored for them', async () => {
    const res = await recommendationsGET(request('GET', '/api/recommendations'));
    assert.equal(res.status, 200);
    const { body } = await read(res);
    assert.equal(body.isAuthenticated, false);
    assert.equal(await prisma.userTasteProfile.count({ where: { userId: 'guest_user' } }), 0);
  });

  test('signed-in users still get their taste profile persisted', async () => {
    const user = await createUser();
    const res = await recommendationsGET(request('GET', '/api/recommendations', { as: user }));
    assert.equal(res.status, 200);
    assert.equal(await prisma.userTasteProfile.count({ where: { userId: user.id } }), 1);
  });
});
