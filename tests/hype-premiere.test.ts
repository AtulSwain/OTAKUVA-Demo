import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { POST as hypePOST } from '../src/app/api/anime/[id]/hype/route';
import { GET as notificationsGET } from '../src/app/api/notifications/route';
import { HYPE_PREMIERE_NOTIFICATION, notifyHypePremieres } from '../src/lib/hype/hypePremiere';

after(async () => {
  await prisma.$disconnect();
});

const HOUR = 3_600_000;
const p = (id: string) => ({ params: { id } });
const hype = async (as: any, id: string) =>
  read(await hypePOST(request('POST', `/api/anime/${id}/hype`, { as, body: { level: 'HYPED' } }), p(id)));

/** An anime whose episode 1 airs in one hour. */
const upcoming = () =>
  createAnime({
    status: 'Not yet aired',
    episodes: 12,
    startDate: new Date(Date.now() + HOUR),
    nextAiringEpisode: 1,
    nextAiringAt: new Date(Date.now() + HOUR),
  });

describe('hyped → tracked → told at the premiere', () => {
  test('voting Hyped adds the anime to the library as Plan to Watch (never changes an existing entry)', async () => {
    const show = await upcoming();
    const [fresh, tracker] = await Promise.all([createUser(), createUser()]);
    await prisma.userAnime.create({ data: { userId: tracker.id, animeId: show.id, status: 'WATCHING' } });

    assert.equal((await hype(fresh, show.id)).status, 200);
    assert.equal((await hype(tracker, show.id)).status, 200);

    const a = await prisma.userAnime.findUniqueOrThrow({ where: { userId_animeId: { userId: fresh.id, animeId: show.id } } });
    assert.equal(a.status, 'PLAN_TO_WATCH');
    const b = await prisma.userAnime.findUniqueOrThrow({ where: { userId_animeId: { userId: tracker.id, animeId: show.id } } });
    assert.equal(b.status, 'WATCHING', 'an existing library status is left alone');
  });

  test('one notification per hyped member, only after episode 1 airs, never twice', async () => {
    const show = await upcoming();
    const [u1, u2, bystander] = await Promise.all([createUser(), createUser(), createUser()]);
    await hype(u1, show.id);
    await hype(u2, show.id);

    // Before the premiere: nothing.
    assert.equal(await notifyHypePremieres({ now: new Date() }), 0);

    // After it: both hyped members, exactly once — even with sweeps running at once.
    const later = new Date(Date.now() + 2 * HOUR);
    const [x, y] = await Promise.all([notifyHypePremieres({ now: later }), notifyHypePremieres({ now: later })]);
    const count = await prisma.notification.count({ where: { type: HYPE_PREMIERE_NOTIFICATION, userId: { in: [u1.id, u2.id] } } });
    assert.equal(count, 2);
    assert.ok(x + y >= 2);
    assert.equal(await notifyHypePremieres({ now: later }), 0, 'already sent');
    assert.equal(await prisma.notification.count({ where: { userId: bystander.id } }), 0, 'only members who hyped it');

    const n = await prisma.notification.findFirstOrThrow({ where: { userId: u1.id, type: HYPE_PREMIERE_NOTIFICATION } });
    assert.match(n.title, /has premiered/);
    assert.equal(n.linkUrl, `/anime/${show.slug}#retention`);
  });

  test('opening notifications delivers a due premiere notice for that member', async () => {
    // Already premiered (time passed) — the member hyped it while it was upcoming.
    const show = await upcoming();
    const u = await createUser();
    await hype(u, show.id);
    await prisma.anime.update({ where: { id: show.id }, data: { nextAiringAt: new Date(Date.now() - 60_000) } });

    const res = await read(await notificationsGET(request('GET', '/api/notifications', { as: u })));
    assert.equal(res.status, 200);
    const premiere = res.body.notifications.filter((x: any) => x.type === HYPE_PREMIERE_NOTIFICATION);
    assert.equal(premiere.length, 1);
    assert.equal(res.body.unreadCount >= 1, true);
    // Opening again doesn't add another.
    const again = await read(await notificationsGET(request('GET', '/api/notifications', { as: u })));
    assert.equal(again.body.notifications.filter((x: any) => x.type === HYPE_PREMIERE_NOTIFICATION).length, 1);
  });
});
