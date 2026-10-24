import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { syncEngine } from '../src/lib/syncEngine';
import type { ProviderAnime } from '../src/lib/providers/animeProvider.interface';

after(async () => {
  await prisma.$disconnect();
});

function providerAnime(over: Partial<ProviderAnime>): ProviderAnime {
  return {
    externalId: '1',
    externalSource: 'anilist',
    malId: null,
    anilistId: null,
    title: 'Dedup Test Show',
    titles: [],
    synopsis: 'A synopsis.',
    type: 'TV',
    status: 'Finished',
    year: 2011,
    posterUrl: 'https://example.com/p.jpg',
    genres: ['Action'],
    themes: [],
    studios: [],
    producers: [],
    licensors: [],
    ...over,
  };
}

describe('syncEngine.ingestAnime de-duplication', () => {
  test('re-importing the same title (same ids) updates it instead of adding a second row', async () => {
    const a = await syncEngine.ingestAnime(providerAnime({ externalId: '9001', anilistId: 9001, malId: 8001, title: 'Same Show' }), 'anilist');
    const b = await syncEngine.ingestAnime(providerAnime({ externalId: '9001', anilistId: 9001, malId: 8001, title: 'Same Show', synopsis: 'Changed.' }), 'anilist');
    assert.equal(a.isNew, true);
    assert.equal(b.isNew, false);
    assert.equal(b.animeId, a.animeId);
    assert.equal(await prisma.anime.count({ where: { malId: 8001 } }), 1);
  });

  test('the same show arriving from the other provider (same MAL id) joins the existing row', async () => {
    const a = await syncEngine.ingestAnime(providerAnime({ externalId: '9101', anilistId: 9101, malId: 8101, title: 'Cross Provider' }), 'anilist');
    const b = await syncEngine.ingestAnime(
      providerAnime({ externalId: '8101', externalSource: 'mal', anilistId: null, malId: 8101, title: 'Cross Provider' }),
      'jikan'
    );
    assert.equal(b.isNew, false);
    assert.equal(b.animeId, a.animeId);
    assert.equal(await prisma.anime.count({ where: { malId: 8101 } }), 1);
  });

  test('a different show with the same title gets its own row and slug, and the original is untouched', async () => {
    const original = await syncEngine.ingestAnime(
      providerAnime({ externalId: '9201', anilistId: 9201, malId: 8201, title: 'Remade Title', year: 1999, synopsis: 'The 1999 one.' }),
      'anilist'
    );
    const remake = await syncEngine.ingestAnime(
      providerAnime({ externalId: '9202', anilistId: 9202, malId: 8202, title: 'Remade Title', year: 2011, synopsis: 'The 2011 one.' }),
      'anilist'
    );
    assert.equal(remake.isNew, true);
    assert.notEqual(remake.animeId, original.animeId);
    assert.equal(remake.slug, 'remade-title-2011');

    const kept = await prisma.anime.findUniqueOrThrow({ where: { id: original.animeId } });
    assert.equal(kept.slug, 'remade-title');
    assert.equal(kept.malId, 8201);
    assert.equal(kept.synopsis, 'The 1999 one.');
  });
});
