import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { GET as vibeGET, POST as vibePOST } from '../src/app/api/anime/[id]/vibe/route';
import { POST as epPOST } from '../src/app/api/anime/[id]/episode-ratings/route';
import { GET as recsGET } from '../src/app/api/anime/[id]/recommendations/route';

after(async () => {
  await prisma.$disconnect();
});

const p = (id: string) => ({ params: { id } });
const vibe = async (as: any, id: string, grades: unknown) =>
  read(await vibePOST(request('POST', `/api/anime/${id}/vibe`, { as, body: { grades } }), p(id)));

describe("What's your vibe (grades per aspect)", () => {
  test('saves grades, averages members, shows the viewer their own; a 1–10 aspect score still counts', async () => {
    const show = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const [a, b, c] = await Promise.all([createUser(), createUser(), createUser()]);

    const first = await vibe(a, show.id, { STORY: 'GREAT', MUSIC: 'GOOD' });
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.mine, { STORY: 'GREAT', MUSIC: 'GOOD' });

    await vibe(b, show.id, { STORY: 'DECENT' });
    // c only used the older 1–10 window (aspect score 9 on Story).
    const rating = await prisma.animeRating.create({ data: { userId: c.id, animeId: show.id, rating: 8 } });
    await prisma.ratingCategoryScore.create({ data: { ratingId: rating.id, category: 'STORY', score: 9 } });

    const s = (await read(await vibeGET(request('GET', `/api/anime/${show.id}/vibe`, { as: b }), p(show.id)))).body;
    const story = s.aspects.find((x: any) => x.category === 'STORY');
    // GREAT (9) + DECENT (6.5) + 9 → 8.17 → Great
    assert.equal(story.responseCount, 3);
    assert.equal(story.grade, 'GREAT');
    assert.equal(s.members, 3);
    assert.deepEqual(s.mine, { STORY: 'DECENT' });
    assert.ok(!('averageScore' in s.aspects[0]) || typeof s.aspects[0].averageScore === 'number');

    // Changing a grade replaces it; null removes it.
    await vibe(a, show.id, { STORY: 'WORST', MUSIC: null });
    const rows = await prisma.$queryRaw<{ category: string; grade: string }[]>`SELECT "category", "grade" FROM "AnimeVibe" WHERE "userId" = ${a.id} AND "animeId" = ${show.id}`;
    assert.deepEqual(rows.map((r) => [r.category, r.grade]), [['STORY', 'WORST']]);
  });

  test('validation, auth, and locked before episode 1 airs', async () => {
    const show = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const u = await createUser();
    assert.equal((await vibe(u, show.id, { STORY: 'AMAZING' })).status, 400);
    assert.equal((await vibe(u, show.id, { DIRECTION: 'GOOD' })).status, 400, 'retired aspect');
    assert.equal((await vibe(u, show.id, {})).status, 400);
    const anon = await read(await vibePOST(request('POST', `/api/anime/${show.id}/vibe`, { body: { grades: { STORY: 'GOOD' } } }), p(show.id)));
    assert.equal(anon.status, 401);
    const upcoming = await createAnime({ status: 'Not yet aired', startDate: new Date(Date.now() + 86_400_000) });
    assert.equal((await vibe(u, upcoming.id, { STORY: 'GOOD' })).status, 403);
  });
});

describe('episode comments', () => {
  test('an optional comment is saved with the rating; omitted keeps it, empty clears it, too long is refused', async () => {
    const show = await createAnime({ status: 'Finished Airing', episodes: 3 });
    const u = await createUser();
    await prisma.userEpisodeWatch.create({ data: { userId: u.id, animeId: show.id, episodeNumber: 1 } });
    const post = async (body: Record<string, unknown>) =>
      read(await epPOST(request('POST', `/api/anime/${show.id}/episode-ratings`, { as: u, body: { episodeNumber: 1, ...body } }), p(show.id)));

    assert.equal((await post({ retention: 80, comment: '  What   an opening!  ' })).status, 200);
    const row = () => prisma.episodeRating.findFirstOrThrow({ where: { userId: u.id, animeId: show.id, episodeNumber: 1 } });
    assert.equal((await row()).review, 'What an opening!');
    assert.equal((await post({ retention: 85 })).status, 200);
    assert.equal((await row()).review, 'What an opening!', 'a rating change without a comment keeps it');
    assert.equal((await post({ retention: 85, comment: 'x'.repeat(281) })).status, 400);
    assert.equal((await post({ retention: 85, comment: '' })).status, 200);
    assert.equal((await row()).review, null);
  });
});

describe('recommendations follow the anime’s genres', () => {
  test('a horror anime recommends horror first; another anime gets a different list', async () => {
    const [horror, action, drama] = await Promise.all(
      ['Horror Test', 'Action Test', 'Drama Test'].map((name) =>
        prisma.genre.upsert({ where: { name }, update: {}, create: { name, slug: name.toLowerCase().replace(/\s+/g, '-') } })
      )
    );
    const make = async (genres: { id: string }[], members = 1000) => {
      const a = await createAnime({ status: 'Finished Airing', episodes: 12, members, isAdult: false });
      await prisma.animeGenre.createMany({ data: genres.map((g) => ({ animeId: a.id, genreId: g.id })) });
      return a;
    };
    const target = await make([horror, drama]);
    const horrorPick = await make([horror], 10);
    const dramaOnly = await make([drama], 999_999); // far more popular, but not horror
    const otherTarget = await make([action]);
    const actionPick = await make([action]);

    const recs = (await read(await recsGET(request('GET', `/api/anime/${target.id}/recommendations`), p(target.id)))).body.items.map((i: any) => i.id);
    assert.ok(recs.includes(horrorPick.id), 'shares the rare genre');
    if (recs.includes(dramaOnly.id)) assert.ok(recs.indexOf(horrorPick.id) < recs.indexOf(dramaOnly.id), 'horror ranks above a drama-only title');

    const other = (await read(await recsGET(request('GET', `/api/anime/${otherTarget.id}/recommendations`), p(otherTarget.id)))).body.items.map((i: any) => i.id);
    assert.ok(other.includes(actionPick.id));
    assert.ok(!other.includes(horrorPick.id), 'an action anime does not get the horror pick');
  });
});
