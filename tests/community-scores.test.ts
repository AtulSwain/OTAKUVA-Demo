import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { GET as scoresGET } from '../src/app/api/anime/community-scores/route';
import { getEpisodeRatingSummary } from '../src/lib/rating/episodeRatings';

after(async () => {
  await prisma.$disconnect();
});

describe('card scores: members only, never the provider score', () => {
  test('score = the anime page OTAKUVA score; retention matches the episode summary; unrated anime are left out', async () => {
    const rated = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const unrated = await createAnime({ status: 'Finished Airing', episodes: 12 });
    // A provider score on both — cards must not show it.
    await prisma.anime.updateMany({ where: { id: { in: [rated.id, unrated.id] } }, data: { score: 8.9 } });

    await prisma.ratingAggregate.create({ data: { animeId: rated.id, ratingCount: 2, rawAverage: 7.25, bayesianScore: 7.1, confidence: 'EARLY' } });
    const [a, b] = await Promise.all([createUser(), createUser()]);
    // a: episodes 1–2 → 70; b: episode 1 → 25 → community (70 + 25) / 2 = 48 (rounded like the summary).
    await prisma.episodeRating.createMany({
      data: [
        { userId: a.id, animeId: rated.id, episodeNumber: 1, retention: 60 },
        { userId: a.id, animeId: rated.id, episodeNumber: 2, retention: 80 },
        { userId: b.id, animeId: rated.id, episodeNumber: 1, retention: 25 },
      ],
    });

    const res = await scoresGET(request('GET', `/api/anime/community-scores?ids=${rated.id},${unrated.id}`));
    assert.equal(res.status, 200);
    const { scores } = (await read(res)).body;
    assert.equal(scores[rated.id].score, 7.25);
    assert.equal(scores[rated.id].ratingCount, 2);
    assert.equal(scores[rated.id].retentionMembers, 2);
    const summary = await getEpisodeRatingSummary(rated.id);
    assert.equal(scores[rated.id].retention, summary.retention.value);
    assert.equal(scores[unrated.id], undefined, 'no placeholder for an anime nobody rated');
  });

  test('verdicts = distinct members who rated an episode or published a review', async () => {
    const anime = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const [a, b, c, d] = await Promise.all([createUser(), createUser(), createUser(), createUser()]);
    await prisma.episodeRating.createMany({
      data: [
        { userId: a.id, animeId: anime.id, episodeNumber: 1, retention: 70 },
        { userId: a.id, animeId: anime.id, episodeNumber: 2, retention: 80 },
      ],
    });
    // a also reviewed: still one verdict. b reviewed without rating. c's review is a draft, d's is deleted.
    const base = { animeId: anime.id, title: '', body: 'x'.repeat(60), watchStatusAtReview: 'COMPLETED' };
    await prisma.review.create({ data: { ...base, userId: a.id } });
    await prisma.review.create({ data: { ...base, userId: b.id } });
    await prisma.review.create({ data: { ...base, userId: c.id, status: 'DRAFT' } });
    await prisma.review.create({ data: { ...base, userId: d.id, deletedAt: new Date() } });

    const res = await scoresGET(request('GET', `/api/anime/community-scores?ids=${anime.id}`));
    const { scores } = (await read(res)).body;
    assert.equal(scores[anime.id].verdicts, 2);
  });

  test('rejects more than 200 ids', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `id${i}`).join(',');
    const res = await scoresGET(request('GET', `/api/anime/community-scores?ids=${ids}`));
    assert.equal(res.status, 400);
  });
});
