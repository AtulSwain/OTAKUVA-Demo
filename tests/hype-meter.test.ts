import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { GET as hypeGET, POST as hypePOST, DELETE as hypeDELETE } from '../src/app/api/anime/[id]/hype/route';
import { buildHypeBoard } from '../src/lib/hype/hypeService';
import { hypePercent } from '../src/lib/hype/hypeLevels';

after(async () => {
  await prisma.$disconnect();
});

const p = (id: string) => ({ params: { id } });
const vote = async (as: any, id: string, level: string) => read(await hypePOST(request('POST', `/api/anime/${id}/hype`, { as, body: { level } }), p(id)));

describe('Hype Meter', () => {
  test('votes only before episode 1 airs; one per member; final once cast; % after 5 votes', async () => {
    const show = await createAnime({ status: 'Not yet aired', episodes: 12, startDate: new Date(Date.now() + 30 * 86_400_000) });
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => createUser()));

    const first = await vote(users[0], show.id, 'HYPED');
    assert.equal(first.status, 200);
    assert.equal(first.body.mine, 'HYPED');
    assert.equal(first.body.percent, null, 'hidden below 5 votes');
    assert.equal((await vote(users[0], show.id, 'NOPE')).status, 400);
    // Excited / Curious (2026-10-22) and Not interested (2026-10-25) were retired: no longer accepted.
    assert.equal((await vote(users[0], show.id, 'EXCITED')).status, 400);
    assert.equal((await vote(users[0], show.id, 'SKIP')).status, 400);
    // Sending the same level again is a no-op.
    const again = await vote(users[0], show.id, 'HYPED');
    assert.equal(again.status, 200);
    assert.equal(again.body.total, 1);
    assert.equal(again.body.mine, 'HYPED');

    await vote(users[1], show.id, 'HYPED');
    await vote(users[2], show.id, 'HYPED');
    await vote(users[3], show.id, 'HYPED');
    const last = await vote(users[4], show.id, 'HYPED');
    assert.deepEqual(last.body.counts, { HYPED: 5 });
    assert.equal(last.body.percent, 100);

    // Guests can read, not vote.
    assert.equal((await hypePOST(request('POST', `/api/anime/${show.id}/hype`, { body: { level: 'HYPED' } }), p(show.id))).status, 401);
    const guest = (await read(await hypeGET(request('GET', `/api/anime/${show.id}/hype`), p(show.id)))).body;
    assert.equal(guest.mine, null);
    assert.equal(guest.open, true);

    // Can't take a vote back either.
    const cleared = await read(await hypeDELETE(request('DELETE', `/api/anime/${show.id}/hype`, { as: users[4] }), p(show.id)));
    assert.equal(cleared.status, 409);
    assert.equal((await read(await hypeGET(request('GET', `/api/anime/${show.id}/hype`), p(show.id)))).body.total, 5);
  });

  test('locked once it airs; the board ranks upcoming shows by a level and skips aired ones', async () => {
    const user = await createUser();
    const aired = await createAnime({ status: 'Finished Airing', episodes: 12 });
    assert.equal((await vote(user, aired.id, 'HYPED')).status, 409);

    const a = await createAnime({ status: 'Not yet aired', startDate: new Date(Date.now() + 5 * 86_400_000) });
    const b = await createAnime({ status: 'Not yet aired', startDate: new Date(Date.now() + 9 * 86_400_000) });
    const started = await createAnime({ status: 'Not yet aired', nextAiringEpisode: 1, nextAiringAt: new Date(Date.now() - 60_000) });
    const [u1, u2] = await Promise.all([createUser(), createUser()]);
    await vote(u1, b.id, 'HYPED');
    await vote(u2, b.id, 'HYPED');
    await vote(u1, a.id, 'HYPED');

    const hyped = await buildHypeBoard('HYPED', 10);
    const ids = hyped.map((i) => i.id);
    assert.ok(ids.indexOf(b.id) < ids.indexOf(a.id), 'more Hyped votes first');
    assert.ok(!ids.includes(started.id));
    const upcoming = (await buildHypeBoard('upcoming', 200)).map((i) => i.id);
    assert.ok(upcoming.includes(a.id) && upcoming.includes(b.id));
    assert.ok(!upcoming.includes(started.id), 'its first episode already aired');
    const quiet = await createAnime({ status: 'Not yet aired', startDate: new Date(Date.now() + 7 * 86_400_000) });
    assert.ok(!ids.includes(quiet.id), 'only shows that got that vote');
  });

  test('hype % weights', () => {
    assert.equal(hypePercent({ HYPED: 5 }), 100);
    assert.equal(hypePercent({ HYPED: 4 }), null);
  });

  test('a stored vote for a retired level is kept, not counted, and can be replaced once', async () => {
    const show = await createAnime({ status: 'Not yet aired', startDate: new Date(Date.now() + 30 * 86_400_000) });
    const user = await createUser();
    await prisma.animeHype.create({ data: { userId: user.id, animeId: show.id, level: 'SKIP' } });
    const before = (await read(await hypeGET(request('GET', `/api/anime/${show.id}/hype`, { as: user }), p(show.id)))).body;
    assert.equal(before.total, 0, 'retired votes are not counted');
    assert.equal(before.mine, null, 'so the member can vote on the current choices');
    const now = await vote(user, show.id, 'HYPED');
    assert.equal(now.status, 200);
    assert.equal(now.body.mine, 'HYPED');
    assert.equal(now.body.total, 1);
    assert.equal((await vote(user, show.id, 'HYPED')).status, 200, 'same level again is a no-op');
    assert.equal(await prisma.animeHype.count({ where: { userId: user.id, animeId: show.id, level: 'HYPED' } }), 1);
    assert.equal(await prisma.animeHype.count({ where: { userId: user.id, animeId: show.id } }), 1);
  });
});

describe('Hype leaderboard accuracy', () => {
  test('most votes of the level always leads — even a show premiering far in the future; exact counts; stable ties', async () => {
    const voters = await Promise.all(Array.from({ length: 6 }, () => createUser()));
    const soon = await createAnime({ status: 'Not yet aired', startDate: new Date(Date.now() + 2 * 86_400_000), canonicalTitle: 'Acc Soon' });
    const far = await createAnime({ status: 'Not yet aired', startDate: new Date(Date.now() + 900 * 86_400_000), canonicalTitle: 'Acc Far' });
    const tieA = await createAnime({ status: 'Not yet aired', startDate: new Date(Date.now() + 10 * 86_400_000), canonicalTitle: 'Acc Tie A' });
    const tieB = await createAnime({ status: 'Not yet aired', startDate: new Date(Date.now() + 20 * 86_400_000), canonicalTitle: 'Acc Tie B' });
    // far: 5 hyped; soon: 4 hyped; tieA / tieB: 2 hyped each (tieA premieres sooner).
    for (const u of voters.slice(0, 5)) await vote(u, far.id, 'HYPED');
    for (const u of voters.slice(0, 4)) await vote(u, soon.id, 'HYPED');
    for (const u of voters.slice(0, 2)) { await vote(u, tieA.id, 'HYPED'); await vote(u, tieB.id, 'HYPED'); }

    const board = await buildHypeBoard('HYPED', 40);
    const pos = (id: string) => board.findIndex((i) => i.id === id);
    assert.ok(pos(far.id) >= 0, 'far-future show is on the board');
    assert.ok(pos(far.id) < pos(soon.id), '5 votes beat 4');
    assert.ok(pos(soon.id) < pos(tieA.id));
    assert.ok(pos(tieA.id) < pos(tieB.id), 'tie → sooner premiere first');
    assert.equal(board[pos(far.id)].counts.HYPED, 5, 'exact count');
  });
});
