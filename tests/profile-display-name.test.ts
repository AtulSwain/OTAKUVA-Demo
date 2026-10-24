import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createUser } from './helpers/fixtures';
import { GET as profileGET, PATCH as profilePATCH } from '../src/app/api/profile/route';
import { GET as meGET } from '../src/app/api/auth/me/route';

after(async () => {
  await prisma.$disconnect();
});

describe('display name', () => {
  test('saved, cleaned, shown with the username; blank clears it; length is capped', async () => {
    const user = await createUser();
    const saved = await read(await profilePATCH(request('PATCH', '/api/profile', { as: user, body: { displayName: '  Victor\u0000   Winters ' } })));
    assert.equal(saved.status, 200);
    assert.equal(saved.body.user.displayName, 'Victor Winters');

    const me = (await read(await meGET(request('GET', '/api/auth/me', { as: user })))).body;
    assert.equal(me.user.displayName, 'Victor Winters');
    assert.equal(me.user.username, user.username);

    const pub = (await read(await profileGET(request('GET', `/api/profile?username=${user.username}`)))).body;
    assert.equal(pub.user.displayName, 'Victor Winters');

    assert.equal((await profilePATCH(request('PATCH', '/api/profile', { as: user, body: { displayName: 'x'.repeat(41) } }))).status, 400);
    assert.equal((await profilePATCH(request('PATCH', '/api/profile', { as: user, body: { displayName: 42 } }))).status, 400);

    await profilePATCH(request('PATCH', '/api/profile', { as: user, body: { displayName: '   ' } }));
    const cleared = (await read(await meGET(request('GET', '/api/auth/me', { as: user })))).body;
    assert.equal(cleared.user.displayName, null, 'blank clears it — the @username shows alone');
  });
});
