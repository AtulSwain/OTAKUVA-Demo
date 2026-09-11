import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma';
import { getAuthUserFromRequest, signJwtToken, verifyJwtToken } from '../src/lib/auth';
import { inferNextEpisodeNumber, isScheduledEpisodeSupported } from '../src/lib/engine/schedule/scheduleEngine';
import { buildTimelineEvents } from '../src/components/anime/timelineEvents';
import { request } from './helpers/http';
import { createAnime, createEpisode, createUser } from './helpers/fixtures';

after(async () => {
  await prisma.$disconnect();
});

const DAY = 86_400_000;

describe('sessions', () => {
  test('a token signed with any other secret is rejected', async () => {
    const user = await createUser();
    const forged = jwt.sign({ userId: user.id, username: user.username, email: user.email }, 'anilog_super_secret_jwt_key_2026');
    assert.equal(verifyJwtToken(forged), null);
    const headers = new Headers({ cookie: `anilog_token=${forged}` });
    const { NextRequest } = await import('next/server');
    assert.equal(await getAuthUserFromRequest(new NextRequest('http://localhost/api/x', { headers })), null);
    assert.equal((await getAuthUserFromRequest(request('GET', '/api/x', { as: user })))?.id, user.id);
  });

  test('production refuses to sign or verify without a private AUTH_SECRET', () => {
    const env = process.env as Record<string, string | undefined>;
    const saved = { NODE_ENV: env.NODE_ENV, AUTH_SECRET: env.AUTH_SECRET };
    const token = signJwtToken({ userId: 'u', username: 'u', email: 'u@test.invalid' });
    try {
      env.NODE_ENV = 'production';
      for (const secret of [undefined, 'short', 'anilog_super_secret_jwt_key_2026']) {
        if (secret === undefined) delete env.AUTH_SECRET;
        else env.AUTH_SECRET = secret;
        assert.throws(() => signJwtToken({ userId: 'u', username: 'u', email: 'u@test.invalid' }));
        assert.equal(verifyJwtToken(token), null);
      }
    } finally {
      env.NODE_ENV = saved.NODE_ENV;
      env.AUTH_SECRET = saved.AUTH_SECRET;
    }
  });
});

describe('schedule inference uses canonical episodes only', () => {
  test('a stale episode import yields no episode number', async () => {
    // Like One Piece in dev.db: the import stopped at an episode from 2017.
    const anime = await createAnime({ status: 'Currently Airing' });
    await createEpisode(anime.id, 800, new Date('2017-08-06'));
    const slot = new Date('2026-09-13T14:15:00Z');
    assert.equal(await inferNextEpisodeNumber(anime.id, slot), null);
    assert.equal(await isScheduledEpisodeSupported(anime.id, 801, slot, null), false);
  });

  test('no recorded episodes yields no episode number, even for "episode 1"', async () => {
    const anime = await createAnime({ status: 'Currently Airing' });
    const slot = new Date('2026-09-11T07:20:00Z');
    assert.equal(await inferNextEpisodeNumber(anime.id, slot), null);
    assert.equal(await isScheduledEpisodeSupported(anime.id, 1, slot, new Date('1988-10-03')), false);
  });

  test('a current import continues the sequence; a recorded episode for the date is used as-is', async () => {
    const anime = await createAnime({ status: 'Currently Airing' });
    const slot = new Date('2026-09-13T14:15:00Z');
    await createEpisode(anime.id, 11, new Date(slot.getTime() - 14 * DAY));
    await createEpisode(anime.id, 12, new Date(slot.getTime() - 7 * DAY));
    assert.equal(await inferNextEpisodeNumber(anime.id, slot), 13);

    await createEpisode(anime.id, 13, new Date(slot.getTime() - 3 * 3_600_000));
    assert.equal(await inferNextEpisodeNumber(anime.id, slot), 13);
  });

  test('a premiere matching the recorded start date is supported', async () => {
    const anime = await createAnime({ status: 'Not yet aired' });
    const premiere = new Date('2026-11-20T00:00:00Z');
    assert.equal(await isScheduledEpisodeSupported(anime.id, 1, premiere, premiere), true);
  });
});

describe('timeline', () => {
  test('only recorded dates and dated relations appear — nothing inferred', () => {
    assert.deepEqual(buildTimelineEvents({ year: 2020, source: 'Manga', studios: ['Madhouse'] }, []), []);

    const events = buildTimelineEvents(
      { airedFrom: '2023-09-29T00:00:00Z', airedTo: '2024-03-22T00:00:00Z', episodes: 28 },
      [
        { relationType: 'Sequel', title: 'Season 2', year: 2026 },
        { relationType: 'Sequel', title: 'Undated sequel' },
        { relationType: 'Character', title: 'Not a timeline entry', year: 2025 },
      ]
    );
    assert.deepEqual(events.map((e) => e.title), ['Premiere', 'Final episode aired', 'Sequel: Season 2']);
  });
});
