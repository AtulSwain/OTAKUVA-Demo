import './helpers/setupTestDb';

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { AnimeCatalogEngine } from '../src/lib/engine/anime/animeCatalogEngine';
import { CacheManager } from '../src/lib/performance/cacheManager';
import { createAnime, createUser } from './helpers/fixtures';

after(async () => {
  await prisma.$disconnect();
});

// queryAnimeCatalog caches non-search results in a static, process-wide L1
// map (CacheManager) — node's test runner gives each test *file* its own
// process (see helpers/setupTestDb.ts), so this only needs to be clean
// within this file, not across the whole suite.
before(() => {
  CacheManager.clearAll();
});

async function attachGenre(animeId: string, name: string) {
  const genre = await prisma.genre.upsert({
    where: { name },
    create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
    update: {},
  });
  await prisma.animeGenre.create({ data: { animeId, genreId: genre.id } });
}

async function attachStudio(animeId: string, name: string) {
  const studio = await prisma.studio.upsert({
    where: { name },
    create: { name },
    update: {},
  });
  await prisma.animeStudio.create({ data: { animeId, studioId: studio.id } });
}

describe('AnimeCatalogEngine.queryAnimeCatalog', () => {
  test('never returns a MERGED anime, even with no other filters', async () => {
    const live = await createAnime({ status: 'Finished' });
    const merged = await createAnime({ status: 'MERGED' });

    const result = await AnimeCatalogEngine.queryAnimeCatalog({ limit: 100 });
    const ids = result.items.map((i) => i.id);
    assert.ok(ids.includes(live.id));
    assert.ok(!ids.includes(merged.id));
  });

  test('genre filter narrows to anime tagged with that genre only', async () => {
    const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const tagged = await createAnime();
    const untagged = await createAnime();
    await attachGenre(tagged.id, `Isekai-${n}`);

    const result = await AnimeCatalogEngine.queryAnimeCatalog({ genre: `Isekai-${n}`, limit: 100 });
    const ids = result.items.map((i) => i.id);
    assert.ok(ids.includes(tagged.id));
    assert.ok(!ids.includes(untagged.id));
    assert.deepEqual(result.items.find((i) => i.id === tagged.id)?.genres, [`Isekai-${n}`]);
  });

  test('studio filter joins through AnimeStudio, and type filter expands TV variants', async () => {
    const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const studioName = `Test Studio ${n}`;
    const tv = await createAnime({ type: 'TV_SHORT' });
    const movie = await createAnime({ type: 'MOVIE' });
    await attachStudio(tv.id, studioName);
    await attachStudio(movie.id, studioName);

    const byStudio = await AnimeCatalogEngine.queryAnimeCatalog({ studio: studioName, limit: 100 });
    const studioIds = byStudio.items.map((i) => i.id);
    assert.ok(studioIds.includes(tv.id));
    assert.ok(studioIds.includes(movie.id));

    const byType = await AnimeCatalogEngine.queryAnimeCatalog({ studio: studioName, type: 'tv', limit: 100 });
    const typeIds = byType.items.map((i) => i.id);
    assert.ok(typeIds.includes(tv.id), 'TV_SHORT is one of the "tv" type variants');
    assert.ok(!typeIds.includes(movie.id));
  });

  test('minScore/maxScore bound the score range inclusively', async () => {
    const low = await createAnime({ score: 4.0 });
    const mid = await createAnime({ score: 7.0 });
    const high = await createAnime({ score: 9.5 });

    const result = await AnimeCatalogEngine.queryAnimeCatalog({ minScore: 6.5, maxScore: 9.5, limit: 100 });
    const ids = result.items.map((i) => i.id);
    assert.ok(!ids.includes(low.id));
    assert.ok(ids.includes(mid.id));
    assert.ok(ids.includes(high.id), 'maxScore bound is inclusive');
  });

  test('sortBy=score desc (default) orders highest score first among matches', async () => {
    const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const genreName = `SortCheck-${n}`;
    const a = await createAnime({ score: 5.0 });
    const b = await createAnime({ score: 9.0 });
    const c = await createAnime({ score: 7.0 });
    for (const anime of [a, b, c]) await attachGenre(anime.id, genreName);

    const result = await AnimeCatalogEngine.queryAnimeCatalog({ genre: genreName, limit: 100 });
    const ordered = result.items.map((i) => i.id);
    assert.deepEqual(ordered, [b.id, c.id, a.id]);
  });

  // Postgres sorts NULL first under DESC; unscored titles used to top
  // "Highest Score" lists.
  test('sortBy=score desc puts unscored anime after scored ones', async () => {
    const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const genreName = `NullSort-${n}`;
    const unscored = await createAnime({ score: null });
    const scored = await createAnime({ score: 6.0 });
    for (const anime of [unscored, scored]) await attachGenre(anime.id, genreName);

    const result = await AnimeCatalogEngine.queryAnimeCatalog({ genre: genreName, limit: 100 });
    assert.deepEqual(result.items.map((i) => i.id), [scored.id, unscored.id]);
  });

  // The validator upper-cases season ("FALL") while the catalog stores
  // "Fall"; the exact-match filter returned nothing on Postgres.
  test('season filter matches regardless of case', async () => {
    const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const genreName = `SeasonCase-${n}`;
    const fall = await createAnime({ season: 'Fall', year: 2026 });
    const winter = await createAnime({ season: 'Winter', year: 2026 });
    for (const anime of [fall, winter]) await attachGenre(anime.id, genreName);

    for (const season of ['FALL', 'Fall', 'fall']) {
      const result = await AnimeCatalogEngine.queryAnimeCatalog({ genre: genreName, season, year: 2026, limit: 100 } as any);
      assert.deepEqual(result.items.map((i) => i.id), [fall.id], season);
    }
  });

  // Jikan's "Finished Airing" was missing from the Finished status filter.
  test('Finished status filter includes both providers’ wording', async () => {
    const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const genreName = `StatusWords-${n}`;
    const anilist = await createAnime({ status: 'Finished' });
    const jikan = await createAnime({ status: 'Finished Airing' });
    for (const anime of [anilist, jikan]) await attachGenre(anime.id, genreName);

    const result = await AnimeCatalogEngine.queryAnimeCatalog({ genre: genreName, status: 'Finished', limit: 100 } as any);
    assert.deepEqual(new Set(result.items.map((i) => i.id)), new Set([anilist.id, jikan.id]));
  });

  test('pagination meta reflects total count and page boundaries', async () => {
    const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const genreName = `PageCheck-${n}`;
    for (let i = 0; i < 5; i++) {
      const anime = await createAnime({ score: 5 + i });
      await attachGenre(anime.id, genreName);
    }

    const page1 = await AnimeCatalogEngine.queryAnimeCatalog({ genre: genreName, limit: 2, page: 1 });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.pagination.total, 5);
    assert.equal(page1.pagination.totalPages, 3);
    assert.equal(page1.pagination.hasPrevPage, false);
    assert.equal(page1.pagination.hasNextPage, true);

    const page3 = await AnimeCatalogEngine.queryAnimeCatalog({ genre: genreName, limit: 2, page: 3 });
    assert.equal(page3.items.length, 1, 'last page has the remainder');
    assert.equal(page3.pagination.hasNextPage, false);
    assert.equal(page3.pagination.hasPrevPage, true);
  });

  test('a non-search query is served from cache on the second identical call', async () => {
    const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const genreName = `CacheCheck-${n}`;
    const anime = await createAnime();
    await attachGenre(anime.id, genreName);

    const filters = { genre: genreName, limit: 10 };
    const first = await AnimeCatalogEngine.queryAnimeCatalog(filters);
    assert.equal(first.cached, false);

    const second = await AnimeCatalogEngine.queryAnimeCatalog(filters);
    assert.equal(second.cached, true);
    assert.deepEqual(second.items.map((i) => i.id), first.items.map((i) => i.id));
  });

  test('a text search (q) is never cached', async () => {
    const anime = await createAnime({ canonicalTitle: 'Unique Search Target' });
    const filters = { q: 'Unique Search Target', limit: 10 };

    const first = await AnimeCatalogEngine.queryAnimeCatalog(filters);
    assert.equal(first.cached, false);
    assert.ok(first.items.map((i) => i.id).includes(anime.id));

    const second = await AnimeCatalogEngine.queryAnimeCatalog(filters);
    assert.equal(second.cached, false, 'search results are never served from the catalog cache');
  });
});

describe('AnimeCatalogEngine.getAnimeByIdOrSlug', () => {
  test('resolves by id and by slug, with genres/studios/titles attached', async () => {
    const anime = await createAnime({ canonicalTitle: 'Detail Lookup Target' });
    await attachGenre(anime.id, 'Action');
    await attachStudio(anime.id, 'Detail Studio');
    await prisma.animeTitle.create({
      data: { animeId: anime.id, type: 'english', title: 'English Detail Title', language: 'en', isPrimary: false },
    });

    const byId = await AnimeCatalogEngine.getAnimeByIdOrSlug(anime.id);
    assert.equal(byId?.id, anime.id);
    assert.deepEqual(byId?.genres, ['Action']);
    const firstStudio = byId?.studios[0];
    assert.equal(typeof firstStudio === 'object' ? firstStudio?.name : firstStudio, 'Detail Studio');
    assert.equal(byId?.englishTitle, 'English Detail Title');

    const bySlug = await AnimeCatalogEngine.getAnimeByIdOrSlug(anime.slug);
    assert.equal(bySlug?.id, anime.id);
  });

  test('includes the authenticated user’s library tracking and watched-episode flags, and never another user’s', async () => {
    const anime = await createAnime({ episodes: 2 });
    const ep1 = await prisma.episode.create({ data: { animeId: anime.id, number: 1 } });
    const ep2 = await prisma.episode.create({ data: { animeId: anime.id, number: 2 } });

    const viewer = await createUser();
    const stranger = await createUser();
    await prisma.userAnime.create({
      data: { userId: viewer.id, animeId: anime.id, status: 'WATCHING', episodesWatched: 1 },
    });
    await prisma.userEpisodeProgress.create({
      data: { userId: viewer.id, animeId: anime.id, episodeId: ep1.id, status: 'COMPLETED' },
    });

    const asViewer = await AnimeCatalogEngine.getAnimeByIdOrSlug(anime.id, viewer.id);
    assert.equal(asViewer?.userTracking?.status, 'WATCHING');
    assert.equal(asViewer?.userTracking?.episodesWatched, 1);
    const watchedFlags = new Map(asViewer?.episodesList.map((e) => [e.id, e.isWatched]));
    assert.equal(watchedFlags.get(ep1.id), true);
    assert.equal(watchedFlags.get(ep2.id), false);

    const asStranger = await AnimeCatalogEngine.getAnimeByIdOrSlug(anime.id, stranger.id);
    assert.equal(asStranger?.userTracking, null);
    assert.ok(asStranger?.episodesList.every((e) => e.isWatched === false));

    const anonymous = await AnimeCatalogEngine.getAnimeByIdOrSlug(anime.id);
    assert.equal(anonymous?.userTracking, null);
  });
});
