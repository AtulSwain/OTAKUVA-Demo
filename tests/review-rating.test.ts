import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { submitUserRating } from '../src/lib/rating/ratingService';

import { GET as reviewsGET, POST as reviewsPOST } from '../src/app/api/reviews/route';

after(async () => {
  await prisma.$disconnect();
});

const BODY = 'A long enough review body to pass the twenty character minimum.';

describe('a review shows the reviewer’s own rating, not a separate score', () => {
  test('a score sent with the review is ignored; the card shows the rating from the rating section, live', async () => {
    const anime = await createAnime();
    const user = await createUser();
    await submitUserRating({ userId: user.id, animeId: anime.id, score: 8 });

    const created = await read(await reviewsPOST(request('POST', '/api/reviews', { as: user, body: { animeId: anime.id, body: BODY, rating: 2 } })));
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const stored = await prisma.review.findFirstOrThrow({ where: { userId: user.id, animeId: anime.id } });
    assert.equal(stored.rating, 8, 'snapshot is the rating-section score, not the 2 sent with the review');

    const list = async () => (await read(await reviewsGET(request('GET', `/api/reviews?animeId=${anime.id}`)))).body;
    const first = (await list()).reviews.find((r: any) => r.user.id === user.id);
    assert.equal(first.rating, 8);

    // Re-rating updates the review card without editing the review.
    await submitUserRating({ userId: user.id, animeId: anime.id, score: 6 });
    const second = (await list()).reviews.find((r: any) => r.user.id === user.id);
    assert.equal(second.rating, 6);
  });

  test('a reviewer who hasn’t rated the anime shows no score', async () => {
    const anime = await createAnime();
    const user = await createUser();
    const created = await read(await reviewsPOST(request('POST', '/api/reviews', { as: user, body: { animeId: anime.id, body: BODY } })));
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const reviews = (await read(await reviewsGET(request('GET', `/api/reviews?animeId=${anime.id}`)))).body.reviews;
    assert.equal(reviews.find((r: any) => r.user.id === user.id).rating, null);
  });
});
