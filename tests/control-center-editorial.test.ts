import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { syncEngine } from '../src/lib/syncEngine';
import type { ProviderAnime } from '../src/lib/providers/animeProvider.interface';
import { read, request } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';

import { POST as formCreate, GET as formOptions } from '../src/app/api/control/anime-form/route';
import { GET as formGet, PUT as formPut } from '../src/app/api/control/anime-form/[id]/route';
import { POST as chartsPost } from '../src/app/api/control/charts/route';
import { PATCH as chartPatch } from '../src/app/api/control/charts/[id]/route';
import { PUT as entriesPut } from '../src/app/api/control/charts/[id]/entries/route';
import { PUT as pickPut } from '../src/app/api/control/picks/[day]/route';
import { POST as newsPost } from '../src/app/api/control/news/route';
import { POST as collectionsPost } from '../src/app/api/control/collections/route';
import { getBrowseList } from '../src/lib/browseService';
import { getTodayPick } from '@control/lib/dailyPicks';

after(async () => {
  await prisma.$disconnect();
});

const json = (as: Awaited<ReturnType<typeof createUser>>, method: string, path: string, body?: unknown) => request(method, path, { as, body });

describe('control center: members are refused everywhere', () => {
  test('anime form, charts, picks, news and collections need an admin', async () => {
    const user = await createUser('USER');
    const calls = [
      formOptions(json(user, 'GET', '/api/control/anime-form')),
      formCreate(json(user, 'POST', '/api/control/anime-form', { canonicalTitle: 'X' })),
      chartsPost(json(user, 'POST', '/api/control/charts', { title: 'Top 10 X', size: 10 })),
      newsPost(json(user, 'POST', '/api/control/news', { title: 'Hello world', content: 'x'.repeat(50) })),
      collectionsPost(json(user, 'POST', '/api/control/collections', { name: 'X' })),
    ];
    for (const res of await Promise.all(calls)) assert.equal(res.status, 403);
  });
});

describe('control center: the anime form', () => {
  test('creates a manual anime with titles, genres, studios and links; edits are protected from sync', async () => {
    const admin = await createUser('ADMIN');
    const genre = await prisma.genre.upsert({ where: { name: 'Action' }, create: { name: 'Action', slug: 'action' }, update: {} });
    const studio = await prisma.studio.create({ data: { name: `Form Studio ${Date.now()}`, slug: `form-studio-${Date.now()}` } });

    const created = await read(
      await formCreate(
        json(admin, 'POST', '/api/control/anime-form', {
          canonicalTitle: 'Control Form Show',
          englishTitle: 'Control Form Show EN',
          nativeTitle: 'コントロール',
          synonyms: ['CFS'],
          synopsis: 'A show made in the control center.',
          type: 'TV',
          status: 'Not Yet Aired',
          episodes: 12,
          season: 'Fall',
          seasonYear: 2027,
          startDate: '2027-10-05',
          posterUrl: 'https://example.com/poster.jpg',
          trailerUrl: 'https://youtu.be/dQw4w9WgXcQ',
          genreIds: [genre.id],
          studios: [{ id: studio.id, isMain: true }],
          streaming: [{ provider: 'Crunchyroll', url: 'https://www.crunchyroll.com/x' }],
        }),
      ),
    );
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const id = created.body.id as string;
    const row = await prisma.anime.findUniqueOrThrow({ where: { id }, include: { titles: true, animeGenres: true, animeStudios: true, streamingAvailability: true } });
    assert.equal(row.externalSource, 'manual');
    assert.equal(row.isAdult, false);
    assert.equal(row.trailerUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(row.year, 2027);
    assert.ok(row.titles.some((t) => t.type === 'japanese' && t.title === 'コントロール'));
    assert.equal(row.animeGenres.length, 1);
    assert.equal(row.animeStudios[0].isMain, true);
    assert.equal(row.streamingAvailability[0].source, 'EDITORIAL');

    // Validation
    const bad = await read(await formCreate(json(admin, 'POST', '/api/control/anime-form', { canonicalTitle: 'Bad', type: 'Cartoon' })));
    assert.equal(bad.status, 400);

    // Edit an existing provider anime: changed fields become overrides…
    const provider = await syncEngine.ingestAnime(
      {
        externalId: '77001', externalSource: 'anilist', malId: null, anilistId: 77001, title: 'Synced Show', titles: [],
        synopsis: 'Provider synopsis.', type: 'TV', status: 'Airing', year: 2024, episodes: 12, posterUrl: 'https://example.com/p.jpg',
        genres: [], themes: [], studios: [], producers: [], licensors: [],
      } as unknown as ProviderAnime,
      'anilist',
    );
    const form = await read(await formGet(json(admin, 'GET', `/api/control/anime-form/${provider.animeId}`), { params: { id: provider.animeId } }));
    assert.equal(form.status, 200);
    const edited = await read(
      await formPut(json(admin, 'PUT', `/api/control/anime-form/${provider.animeId}`, { ...form.body.values, episodes: 13, status: 'Finished' }), { params: { id: provider.animeId } }),
    );
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.deepEqual(edited.body.changed.sort(), ['episodes', 'status']);

    // …so a later sync with different provider data leaves them alone.
    await syncEngine.ingestAnime(
      {
        externalId: '77001', externalSource: 'anilist', malId: null, anilistId: 77001, title: 'Synced Show', titles: [],
        synopsis: 'Provider synopsis v2.', type: 'TV', status: 'Airing', year: 2024, episodes: 24, posterUrl: 'https://example.com/p.jpg',
        genres: [], themes: [], studios: [], producers: [], licensors: [], score: 8.1,
      } as unknown as ProviderAnime,
      'anilist',
    );
    const after = await prisma.anime.findUniqueOrThrow({ where: { id: provider.animeId } });
    assert.equal(after.episodes, 13, 'editor value kept');
    assert.equal(after.status, 'Finished', 'editor value kept');
    assert.equal(after.synopsis, 'Provider synopsis v2.', 'fields nobody edited still sync');
  });
});

describe('control center: charts, daily picks, news, collections', () => {
  test('a chart holds at most its size, publishes, and OTAKUVA Choice drives Top Picks', async () => {
    const admin = await createUser('ADMIN');
    // Top Picks only lists anime that have a poster.
    const poster = { posterUrl: 'https://example.com/poster.jpg' };
    const anime = await Promise.all([createAnime(poster), createAnime(poster), createAnime(poster)]);
    const made = await read(await chartsPost(json(admin, 'POST', '/api/control/charts', { title: 'OTAKUVA Choice', size: 10, slug: 'otakuva-choice' })));
    assert.equal(made.status, 200, JSON.stringify(made.body));
    const id = made.body.id;

    const emptyPublish = await read(await chartPatch(json(admin, 'PATCH', `/api/control/charts/${id}`, { isPublished: true }), { params: { id } }));
    assert.equal(emptyPublish.status, 400, 'an empty chart cannot be published');

    const set = await read(
      await entriesPut(json(admin, 'PUT', `/api/control/charts/${id}/entries`, { entries: anime.map((a, i) => ({ animeId: a.id, note: `note ${i}` })).reverse() }), { params: { id } }),
    );
    assert.equal(set.status, 200, JSON.stringify(set.body));
    assert.deepEqual(set.body.items.map((i: { animeId: string }) => i.animeId), anime.map((a) => a.id).reverse());

    const tooMany = await read(
      await entriesPut(json(admin, 'PUT', `/api/control/charts/${id}/entries`, { entries: Array.from({ length: 11 }, (_, i) => ({ animeId: `x${i}` })) }), { params: { id } }),
    );
    assert.equal(tooMany.status, 400);

    const pub = await read(await chartPatch(json(admin, 'PATCH', `/api/control/charts/${id}`, { isPublished: true }), { params: { id } }));
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const choice = await getBrowseList('choice', {});
    assert.deepEqual(choice.map((c) => c.id), anime.map((a) => a.id).reverse(), 'Top Picks follows the published chart');
  });

  test("a daily pick is today's homepage spotlight; past days are refused", async () => {
    const admin = await createUser('ADMIN');
    const anime = await createAnime();
    const today = new Date().toISOString().slice(0, 10);
    const ok = await read(await pickPut(json(admin, 'PUT', `/api/control/picks/${today}`, { animeId: anime.id, note: 'Watch this.' }), { params: { day: today } }));
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const pick = await getTodayPick();
    assert.equal(pick?.animeId, anime.id);
    assert.equal(pick?.note, 'Watch this.');
    const past = await read(await pickPut(json(admin, 'PUT', '/api/control/picks/2000-01-01', { animeId: anime.id }), { params: { day: '2000-01-01' } }));
    assert.equal(past.status, 400);
  });

  test('news is an OTAKUVA editorial story with its full text; collections keep their order', async () => {
    const admin = await createUser('ADMIN');
    const anime = await Promise.all([createAnime(), createAnime()]);
    const news = await read(
      await newsPost(json(admin, 'POST', '/api/control/news', { title: 'OTAKUVA launches charts', content: 'Paragraph one is long enough.\n\nParagraph two.', status: 'PUBLISHED', animeIds: [anime[0].id] })),
    );
    assert.equal(news.status, 200, JSON.stringify(news.body));
    const story = await prisma.newsArticle.findUniqueOrThrow({ where: { id: news.body.id }, include: { animeRelations: true } });
    assert.equal(story.provider, 'INTERNAL');
    assert.equal(story.contentType, 'OTAKUVA_EDITORIAL');
    assert.equal(story.status, 'PUBLISHED');
    assert.equal(story.animeRelations.length, 1);

    const col = await read(await collectionsPost(json(admin, 'POST', '/api/control/collections', { name: 'Staff picks', visibility: 'PUBLIC', animeIds: [anime[1].id, anime[0].id] })));
    assert.equal(col.status, 200, JSON.stringify(col.body));
    const items = await prisma.userListItem.findMany({ where: { listId: col.body.id }, orderBy: { position: 'asc' } });
    assert.deepEqual(items.map((i) => i.animeId), [anime[1].id, anime[0].id]);
  });
});
