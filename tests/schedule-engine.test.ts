import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { ScheduleEngine } from '../src/lib/engine/schedule/scheduleEngine';
import { createAnime, createUser } from './helpers/fixtures';

after(async () => {
  await prisma.$disconnect();
});

// A fixed instant so "the 7-day window" and delay-detection math are
// deterministic instead of depending on when the suite happens to run.
const NOW = new Date('2026-06-15T12:00:00.000Z');
const DAY_MS = 86_400_000;

describe('ScheduleEngine.querySchedule', () => {
  test('default window is ~24h in the past to 7 days ahead of referenceDate', async () => {
    const anime = await createAnime();
    const inWindow = await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 1,
      airingAt: new Date(NOW.getTime() + 2 * DAY_MS),
    });
    const beforeWindow = await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 2,
      airingAt: new Date(NOW.getTime() - 3 * DAY_MS),
    });
    const afterWindow = await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 3,
      airingAt: new Date(NOW.getTime() + 10 * DAY_MS),
    });

    const result = await ScheduleEngine.querySchedule({}, null, NOW);
    const ids = result.data.map((i) => i.id);
    assert.ok(ids.includes(inWindow.id));
    assert.ok(!ids.includes(beforeWindow.id));
    assert.ok(!ids.includes(afterWindow.id));
  });

  test('libraryOnly with no library returns empty without querying schedules', async () => {
    const user = await createUser();
    const result = await ScheduleEngine.querySchedule({ libraryOnly: true }, user.id, NOW);
    assert.deepEqual(result.data, []);
    assert.equal(result.total, 0);
    assert.equal(result.libraryOnly, true);
  });

  test('libraryOnly returns only schedule events for anime in the user’s library', async () => {
    const user = await createUser();
    const tracked = await createAnime();
    const untracked = await createAnime();
    await prisma.userAnime.create({ data: { userId: user.id, animeId: tracked.id, status: 'WATCHING' } });

    const trackedEvent = await ScheduleEngine.ingestScheduleEvent({
      animeId: tracked.id,
      episode: 1,
      airingAt: new Date(NOW.getTime() + DAY_MS),
    });
    await ScheduleEngine.ingestScheduleEvent({
      animeId: untracked.id,
      episode: 1,
      airingAt: new Date(NOW.getTime() + DAY_MS),
    });

    const result = await ScheduleEngine.querySchedule({ libraryOnly: true }, user.id, NOW);
    assert.deepEqual(result.data.map((i) => i.id), [trackedEvent.id]);
    assert.equal(result.data[0].inLibrary, true);
    assert.equal(result.data[0].libraryStatus, 'WATCHING');
  });

  test('sort=popularity orders results by anime popularity, highest first', async () => {
    const low = await createAnime({ popularity: 10 });
    const high = await createAnime({ popularity: 9000 });
    const evLow = await ScheduleEngine.ingestScheduleEvent({ animeId: low.id, episode: 1, airingAt: new Date(NOW.getTime() + DAY_MS) });
    const evHigh = await ScheduleEngine.ingestScheduleEvent({ animeId: high.id, episode: 1, airingAt: new Date(NOW.getTime() + 2 * DAY_MS) });

    const result = await ScheduleEngine.querySchedule({ sort: 'popularity' }, null, NOW);
    const ids = result.data.map((i) => i.id).filter((id) => id === evLow.id || id === evHigh.id);
    assert.deepEqual(ids, [evHigh.id, evLow.id]);
  });

  test('pagination slices the (day-filtered, sorted) result set and totals reflect the full match count', async () => {
    const anime = await createAnime();
    for (let i = 1; i <= 5; i++) {
      await ScheduleEngine.ingestScheduleEvent({ animeId: anime.id, episode: i, airingAt: new Date(NOW.getTime() + i * DAY_MS) });
    }

    const page1 = await ScheduleEngine.querySchedule({ animeId: anime.id, limit: 2, page: 1 }, null, NOW);
    assert.equal(page1.data.length, 2);
    assert.equal(page1.total, 5);
    assert.equal(page1.meta.totalPages, 3);
    assert.equal(page1.meta.hasNextPage, true);

    const page3 = await ScheduleEngine.querySchedule({ animeId: anime.id, limit: 2, page: 3 }, null, NOW);
    assert.equal(page3.data.length, 1);
    assert.equal(page3.meta.hasNextPage, false);
  });
});

describe('ScheduleEngine.ingestScheduleEvent', () => {
  test('creates a new schedule row unverified by default, and upserts on (animeId, episode, releaseType)', async () => {
    const anime = await createAnime();
    const created = await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 1,
      airingAt: new Date(NOW.getTime() + DAY_MS),
    });
    assert.equal(created.releaseType, 'BROADCAST');
    assert.equal(created.scheduleStatus, 'UPCOMING');
    assert.equal(created.isVerified, false);

    const rowCountBefore = await prisma.airingSchedule.count({ where: { animeId: anime.id } });
    await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 1,
      airingAt: new Date(NOW.getTime() + DAY_MS),
      notes: 'still the same slot',
    });
    const rowCountAfter = await prisma.airingSchedule.count({ where: { animeId: anime.id } });
    assert.equal(rowCountAfter, rowCountBefore, 'same (animeId, episode, releaseType) updates in place');
  });

  test('pushing airingAt back by more than an hour marks the event DELAYED and records originalAiringAt', async () => {
    const anime = await createAnime();
    const original = await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 1,
      airingAt: new Date(NOW.getTime() + DAY_MS),
    });

    const delayed = await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 1,
      airingAt: new Date(NOW.getTime() + DAY_MS + 3 * 60 * 60 * 1000), // +3h
    });

    assert.equal(delayed.scheduleStatus, 'DELAYED');
    assert.equal(delayed.originalAiringAt?.toISOString(), original.airingAt.toISOString());
  });

  test('resolves episodeId/seasonId from a matching canonical Episode when not supplied', async () => {
    const anime = await createAnime();
    const episode = await prisma.episode.create({ data: { animeId: anime.id, number: 3 } });

    const event = await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 3,
      airingAt: new Date(NOW.getTime() + DAY_MS),
    });

    assert.equal(event.episodeId, episode.id);
  });
});

describe('ScheduleEngine.toggleReminder / getUserReminders', () => {
  test('toggles a reminder on, off, and back on (reactivation, not a duplicate row)', async () => {
    const user = await createUser();
    const anime = await createAnime();
    const event = await ScheduleEngine.ingestScheduleEvent({ animeId: anime.id, episode: 1, airingAt: new Date(NOW.getTime() + DAY_MS) });

    const on = await ScheduleEngine.toggleReminder(user.id, event.id);
    assert.equal(on.active, true);

    const off = await ScheduleEngine.toggleReminder(user.id, event.id);
    assert.equal(off.active, false);
    assert.equal(off.reminderId, null);

    const onAgain = await ScheduleEngine.toggleReminder(user.id, event.id);
    assert.equal(onAgain.active, true);

    const rowCount = await prisma.scheduleReminder.count({ where: { userId: user.id, scheduleId: event.id } });
    assert.equal(rowCount, 1, 'reactivation reuses the same row rather than creating a second one');
  });

  test('getUserReminders only returns PENDING reminders, not cancelled ones', async () => {
    const user = await createUser();
    const anime = await createAnime();
    const kept = await ScheduleEngine.ingestScheduleEvent({ animeId: anime.id, episode: 1, airingAt: new Date(NOW.getTime() + DAY_MS) });
    const cancelled = await ScheduleEngine.ingestScheduleEvent({ animeId: anime.id, episode: 2, airingAt: new Date(NOW.getTime() + 2 * DAY_MS) });

    await ScheduleEngine.toggleReminder(user.id, kept.id);
    await ScheduleEngine.toggleReminder(user.id, cancelled.id);
    await ScheduleEngine.toggleReminder(user.id, cancelled.id); // toggled back off

    const reminders = await ScheduleEngine.getUserReminders(user.id);
    assert.deepEqual(reminders.data.map((r) => r.id), [kept.id]);
  });
});

describe('ScheduleEngine.getUpNextSchedule', () => {
  test('only surfaces episodes ahead of the user’s watched progress, one per anime', async () => {
    const user = await createUser();
    const anime = await createAnime();
    await prisma.userAnime.create({ data: { userId: user.id, animeId: anime.id, status: 'WATCHING', episodesWatched: 2 } });

    const alreadyWatched = await ScheduleEngine.ingestScheduleEvent({ animeId: anime.id, episode: 2, airingAt: new Date(NOW.getTime() + DAY_MS) });
    const next = await ScheduleEngine.ingestScheduleEvent({ animeId: anime.id, episode: 3, airingAt: new Date(NOW.getTime() + 2 * DAY_MS) });

    const result = await ScheduleEngine.getUpNextSchedule(user.id, 'UTC', 10, NOW);
    assert.deepEqual(result.data.map((i) => i.id), [next.id]);
    assert.ok(!result.data.map((i) => i.id).includes(alreadyWatched.id));
  });

  test('an empty library yields no up-next items', async () => {
    const user = await createUser();
    const result = await ScheduleEngine.getUpNextSchedule(user.id, 'UTC', 10, NOW);
    assert.deepEqual(result.data, []);
    assert.equal(result.total, 0);
  });
});

describe('ScheduleEngine.getDataQualityReport', () => {
  // getDataQualityReport() aggregates over the *entire* AiringSchedule
  // table (it's a global admin report, not scoped to one anime), and
  // earlier describe blocks in this file already created rows there — so
  // this re-derives the expected numbers straight from the same raw counts
  // Prisma holds after this test's inserts, using the engine's own
  // documented formula, rather than assuming an absolute row count.
  test('totals, percentages, and health score match the raw counts and the documented weighting', async () => {
    const anime = await createAnime();
    const episode = await prisma.episode.create({ data: { animeId: anime.id, number: 1 } });

    // Fully linked + verified.
    await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 1,
      episodeId: episode.id,
      airingAt: new Date(NOW.getTime() + DAY_MS),
      isVerified: true,
    });
    // No episodeId resolvable, unverified.
    await ScheduleEngine.ingestScheduleEvent({
      animeId: anime.id,
      episode: 2,
      airingAt: new Date(NOW.getTime() + 2 * DAY_MS),
      isVerified: false,
    });

    const [totalSchedules, linkedEpisodes, linkedSeasons, verifiedCount] = await Promise.all([
      prisma.airingSchedule.count(),
      prisma.airingSchedule.count({ where: { episodeId: { not: null } } }),
      prisma.airingSchedule.count({ where: { seasonId: { not: null } } }),
      prisma.airingSchedule.count({ where: { isVerified: true } }),
    ]);

    const linkedEpPct = (linkedEpisodes / totalSchedules) * 100;
    const linkedSeasonPct = (linkedSeasons / totalSchedules) * 100;
    const verifiedPct = (verifiedCount / totalSchedules) * 100;
    const expectedHealthScore = Math.round(linkedEpPct * 0.4 + verifiedPct * 0.4 + linkedSeasonPct * 0.2);

    const report = await ScheduleEngine.getDataQualityReport();
    assert.equal(report.totalSchedules, totalSchedules);
    assert.equal(report.linkedEpisodePercentage, Math.round(linkedEpPct * 10) / 10);
    assert.equal(report.verifiedPercentage, Math.round(verifiedPct * 10) / 10);
    assert.equal(report.healthScore, expectedHealthScore);
  });
});
