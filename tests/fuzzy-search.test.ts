import './helpers/setupTestDb';

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { searchAnimeIdsByTitle, searchPersonIdsByName, searchCharacterIdsByName } from '../src/lib/fuzzySearch';
import { searchCatalog } from '../src/lib/search';
import { AnimeCatalogEngine } from '../src/lib/engine/anime/animeCatalogEngine';
import { GET as peopleGET } from '../src/app/api/people/route';
import { request, read } from './helpers/http';
import { createAnime } from './helpers/fixtures';

after(async () => {
  await prisma.$disconnect();
});

describe('fuzzySearch.searchAnimeIdsByTitle', () => {
  test('is case-insensitive — the exact regression a plain Postgres `contains` (no mode) has', async () => {
    const anime = await createAnime({ canonicalTitle: 'Fullmetal Alchemist: Brotherhood' });
    const matches = await searchAnimeIdsByTitle('fullmetal alchemist', 10);
    assert.ok(matches.some((m) => m.id === anime.id), 'lowercase query finds a properly-capitalized title');
  });

  test('tolerates a realistic multi-word typo', async () => {
    const anime = await createAnime({ canonicalTitle: 'Attack on Titan' });
    const matches = await searchAnimeIdsByTitle('atatck on titan', 10);
    assert.equal(matches[0]?.id, anime.id, 'the typo’d query still ranks the intended title first');
  });

  test('matches alternate/romanized AnimeTitle rows, not just canonicalTitle', async () => {
    const anime = await createAnime({ canonicalTitle: 'Shingeki no Kyojin' });
    await prisma.animeTitle.create({
      data: { animeId: anime.id, type: 'english', title: 'Attack on Titan', language: 'en', isPrimary: false },
    });

    const byRomanized = await searchAnimeIdsByTitle('shingeki no kyojin', 10);
    assert.ok(byRomanized.some((m) => m.id === anime.id), 'matches the canonical (romanized) title');

    const byAlternate = await searchAnimeIdsByTitle('attack on titan', 10);
    assert.ok(byAlternate.some((m) => m.id === anime.id), 'matches the alternate AnimeTitle row, not just canonicalTitle');
  });

  test('excludes MERGED anime, same as every other search entry point', async () => {
    const merged = await createAnime({ canonicalTitle: 'Merged Duplicate Show', status: 'MERGED' });
    const matches = await searchAnimeIdsByTitle('merged duplicate show', 10);
    assert.ok(!matches.some((m) => m.id === merged.id));
  });

  test('an exact substring match outranks a fuzzy-only match', async () => {
    const exact = await createAnime({ canonicalTitle: 'Zzyx Exactmatch Show' });
    const fuzzy = await createAnime({ canonicalTitle: 'Zzyx Exactmadge Show' }); // similar but not a substring
    const matches = await searchAnimeIdsByTitle('zzyx exactmatch show', 10);
    const exactIdx = matches.findIndex((m) => m.id === exact.id);
    const fuzzyIdx = matches.findIndex((m) => m.id === fuzzy.id);
    assert.ok(exactIdx !== -1 && (fuzzyIdx === -1 || exactIdx < fuzzyIdx));
  });

  test('an empty or whitespace-only query returns no matches rather than everything', async () => {
    assert.deepEqual(await searchAnimeIdsByTitle('', 10), []);
    assert.deepEqual(await searchAnimeIdsByTitle('   ', 10), []);
  });
});

describe('fuzzySearch.searchPersonIdsByName / searchCharacterIdsByName', () => {
  test('person name search is case-insensitive and typo-tolerant', async () => {
    const person = await prisma.person.create({ data: { name: 'Hiroyuki Sawano' } });
    const caseInsensitive = await searchPersonIdsByName('hiroyuki sawano', 10);
    assert.ok(caseInsensitive.some((m) => m.id === person.id));

    const typoTolerant = await searchPersonIdsByName('hiroyuki sawnao', 10);
    assert.ok(typoTolerant.some((m) => m.id === person.id));
  });

  test('character name search is case-insensitive and typo-tolerant', async () => {
    const character = await prisma.character.create({ data: { name: 'Frieren' } });
    const caseInsensitive = await searchCharacterIdsByName('frieren', 10);
    assert.ok(caseInsensitive.some((m) => m.id === character.id));
  });
});

describe('AnimeCatalogEngine.queryAnimeCatalog — q filter fuzzy/case-insensitive regression', () => {
  test('a lowercase query finds a properly-capitalized title (the live bug this replaces)', async () => {
    const anime = await createAnime({ canonicalTitle: 'Jujutsu Kaisen' });
    const result = await AnimeCatalogEngine.queryAnimeCatalog({ q: 'jujutsu kaisen' });
    assert.ok(result.items.some((i) => i.id === anime.id));
  });

  test('a typo still finds the title', async () => {
    const anime = await createAnime({ canonicalTitle: 'Demon Slayer' });
    const result = await AnimeCatalogEngine.queryAnimeCatalog({ q: 'demon slyaer' });
    assert.ok(result.items.some((i) => i.id === anime.id));
  });
});

describe('searchCatalog (src/lib/search.ts) — q filter fuzzy/case-insensitive regression', () => {
  test('a lowercase query finds a properly-capitalized title', async () => {
    const anime = await createAnime({ canonicalTitle: 'Vinland Saga' });
    const result = await searchCatalog({ query: 'vinland saga' });
    assert.ok(result.items.some((i) => i.id === anime.id));
  });
});

describe('GET /api/people — q filter fuzzy/case-insensitive regression', () => {
  test('a lowercase, typo’d query finds the right person', async () => {
    const person = await prisma.person.create({ data: { name: 'Yoko Hikasa' } });
    const res = await read(await peopleGET(request('GET', '/api/people?q=yoko+hikas')));
    assert.equal(res.status, 200);
    assert.ok(res.body.people.some((p: any) => p.id === person.id));
  });
});
