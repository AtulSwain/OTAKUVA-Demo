import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { createAnime } from './helpers/fixtures';
import { POST as trackView } from '../src/app/api/track/view/route';
import { getAnimeAnalytics, getCollectionAnalytics, getCommunityAnalytics, getMemberAnalytics, getNewsAnalytics } from '@control/lib/analytics';

after(async () => {
  await prisma.$disconnect();
});

let ip = 0;
const view = (body: unknown, ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130') =>
  trackView(
    new NextRequest(new URL('/api/track/view', 'http://localhost:3000'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': ua, 'x-forwarded-for': `10.77.0.${++ip}` },
      body: JSON.stringify(body),
    }),
  );

describe('page view counting', () => {
  test('counts real views per page per day; ignores bots, unknown kinds and bad ids', async () => {
    const anime = await createAnime({ posterUrl: 'https://example.com/p.jpg' });
    await view({ kind: 'anime', id: anime.id });
    await view({ kind: 'anime', id: anime.id });
    await view({ kind: 'anime', id: anime.id }, 'Googlebot/2.1');
    await view({ kind: 'users', id: anime.id });
    await view({ kind: 'anime', id: "x'; DROP TABLE" });
    const rows = await prisma.$queryRaw<{ views: number }[]>`SELECT views FROM "PageViewDaily" WHERE kind = 'anime' AND "entityId" = ${anime.id}`;
    assert.equal(rows[0]?.views, 2);

    const a = await getAnimeAnalytics(7);
    assert.equal(a.kpi.viewsToday, 2);
    assert.equal(a.topViewed[0]?.id, anime.id);
    assert.equal(a.viewSeries.length, 7);
  });
});

describe('analytics sections', () => {
  test('every section loads with zero-filled day series', async () => {
    for (const fn of [getNewsAnalytics, getCollectionAnalytics, getMemberAnalytics, getCommunityAnalytics]) {
      const r = (await fn(30)) as { kpi: Record<string, number> } & Record<string, unknown>;
      assert.ok(r.kpi, 'has numbers');
      const seriesKey = Object.keys(r).find((k) => k.endsWith('Series'));
      assert.ok(seriesKey);
      assert.equal((r[seriesKey!] as unknown[]).length, 30);
    }
  });
});

describe('admin alerts + main desk', () => {
  test('admins are notified when someone becomes a creator; the desk lists creators and activity', async () => {
    const { createUser } = await import('./helpers/fixtures');
    const { upgradeToCreator } = await import('../src/lib/creator/creatorService');
    const { listCreators, activityFeed, platformTotals } = await import('@control/lib/platform');
    const admin = await createUser('ADMIN');
    const member = await createUser('USER');
    await upgradeToCreator(member.id, { channelName: 'Desk Test Channel' });
    const alerts = await prisma.notification.findMany({ where: { userId: admin.id, type: 'ADMIN_NEW_CREATOR' } });
    assert.equal(alerts.length, 1);
    assert.ok((await listCreators()).some((c) => c.id === member.id && c.channel === 'Desk Test Channel'));
    assert.ok((await activityFeed(50, 'creator')).some((f) => f.who === member.username));
    assert.ok((await platformTotals()).creators >= 1);
  });
});
