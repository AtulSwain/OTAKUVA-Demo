import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { createAnime, createUser } from './helpers/fixtures';
import { buildFrontPageSections, currentSeason, POPULAR_MIN_SHOWS, POPULAR_MIN_TRACKERS } from '../src/lib/home/frontPage';

after(async () => {
  await prisma.$disconnect();
});

const NOW = new Date(Date.UTC(2026, 9, 19, 12)); // Mon 19 Oct 2026

describe('homepage front page', () => {
  test('never shows private-community threads; trending ranks by replies', async () => {
    const owner = await createUser();
    const open = await prisma.community.create({ data: { ownerId: owner.id, name: 'Open club', slug: `open-${Date.now()}`, description: 'x' } });
    const secret = await prisma.community.create({ data: { ownerId: owner.id, name: 'Secret club', slug: `secret-${Date.now()}`, description: 'x', visibility: 'PRIVATE' } });
    await prisma.discussion.create({ data: { authorId: owner.id, title: 'Public quiet thread', body: 'x' } });
    await prisma.discussion.create({ data: { authorId: owner.id, communityId: open.id, title: 'Busy open-community thread', body: 'x', replyCount: 9 } });
    await prisma.discussion.create({ data: { authorId: owner.id, communityId: secret.id, title: 'Members-only thread', body: 'x', replyCount: 50 } });

    const fp = await buildFrontPageSections(NOW);
    const titles = fp.discussions.map((d) => d.title);
    assert.ok(!titles.includes('Members-only thread'));
    assert.deepEqual(titles.slice(0, 2), ['Busy open-community thread', 'Public quiet thread']);
    assert.equal(fp.stats.discussions, 2, 'the masthead count leaves private threads out too');
  });

  test("reviews show the reviewer's live score and never a spoiler review's text", async () => {
    const user = await createUser();
    const anime = await createAnime({ posterUrl: 'https://img.test/p.jpg' });
    await prisma.animeRating.create({ data: { userId: user.id, animeId: anime.id, rating: 8.5 } });
    await prisma.review.create({ data: { userId: user.id, animeId: anime.id, title: '', body: 'A clean, spoiler-free take on the show.' } });
    const spoiler = await createAnime({ posterUrl: 'https://img.test/q.jpg' });
    await prisma.review.create({ data: { userId: user.id, animeId: spoiler.id, title: '', body: 'The hero dies in episode 12.', containsSpoiler: true, spoilerLevel: 'SPOILERS' } });

    const fp = await buildFrontPageSections(NOW);
    const clean = fp.reviews.find((r) => r.anime.slug === anime.slug)!;
    assert.equal(clean.rating, 8.5);
    assert.match(clean.excerpt!, /spoiler-free take/);
    const hidden = fp.reviews.find((r) => r.anime.slug === spoiler.slug)!;
    assert.equal(hidden.spoiler, true);
    assert.equal(hidden.excerpt, null);
    assert.ok(!JSON.stringify(fp.reviews).includes('dies in episode 12'));
  });

  test("this season and this week in history come from real dates", async () => {
    const { season, year } = currentSeason(NOW);
    assert.deepEqual({ season, year }, { season: 'Fall', year: 2026 });
    const seasonal = await createAnime({ posterUrl: 'https://img.test/s.jpg', season: 'FALL', year: 2026, members: 1000 });
    const thisWeek = await createAnime({ posterUrl: 'https://img.test/h.jpg', startDate: new Date(Date.UTC(2006, 9, 17)), datePrecision: 'DAY', members: 500 });
    const today = await createAnime({ posterUrl: 'https://img.test/t.jpg', startDate: new Date(Date.UTC(2011, 9, 19)), datePrecision: 'DAY', members: 400 });
    await createAnime({ posterUrl: 'https://img.test/far.jpg', startDate: new Date(Date.UTC(2006, 9, 25)), datePrecision: 'DAY' });
    await createAnime({ posterUrl: 'https://img.test/y.jpg', startDate: new Date(Date.UTC(2006, 9, 19)), datePrecision: 'YEAR' });

    const fp = await buildFrontPageSections(NOW);
    assert.ok(fp.season.items.some((a) => a.id === seasonal.id), 'season match is case-insensitive');
    assert.deepEqual(fp.onThisDay.map((a) => a.id), [thisWeek.id, today.id]);
    assert.equal(fp.onThisDay[0].yearsAgo, 20);
    assert.equal(fp.onThisDay[0].today, false);
    assert.equal(fp.onThisDay[1].today, true);
  });

  test('Most popular counts OTAKUVA trackers and stays hidden until there is enough of them', async () => {
    const users = await Promise.all(Array.from({ length: POPULAR_MIN_TRACKERS }, () => createUser()));
    const shows = await Promise.all(Array.from({ length: POPULAR_MIN_SHOWS }, (_, i) => createAnime({ posterUrl: `https://img.test/pop${i}.jpg`, members: 9_000_000 })));
    // One show short of the threshold: hidden, however big the provider member counts are.
    for (const show of shows.slice(0, -1)) {
      await prisma.userAnime.createMany({ data: users.map((u) => ({ userId: u.id, animeId: show.id, status: 'WATCHING' })) });
    }
    assert.deepEqual((await buildFrontPageSections(NOW)).rankings.mostPopular, []);

    await prisma.userAnime.createMany({ data: users.map((u) => ({ userId: u.id, animeId: shows.at(-1)!.id, status: 'COMPLETED' })) });
    const extra = await createUser();
    await prisma.userAnime.create({ data: { userId: extra.id, animeId: shows[2].id, status: 'PLAN_TO_WATCH' } });
    const popular = (await buildFrontPageSections(NOW)).rankings.mostPopular;
    assert.equal(popular.length, POPULAR_MIN_SHOWS);
    assert.equal(popular[0].id, shows[2].id);
    assert.equal(popular[0].trackers, POPULAR_MIN_TRACKERS + 1);
  });
});
