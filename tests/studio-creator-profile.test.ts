import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { createAnime } from './helpers/fixtures';
import { getStudioProfile } from '../src/lib/studios/studioProfile';
import { getCreatorProfile } from '../src/lib/people/creatorProfile';
import { isProviderPlaceholderImage } from '../src/lib/mediaResolver';

after(async () => {
  await prisma.$disconnect();
});

let n = 0;
const uid = () => `${Date.now()}-${++n}`;

async function studio(extra: Record<string, unknown> = {}) {
  const id = uid();
  return prisma.studio.create({ data: { name: `Studio ${id}`, slug: `studio-${id}`, ...extra } });
}

describe('studio page data', () => {
  test('counts come from the catalog; "Finished Airing" is not airing; no invented location', async () => {
    const s = await studio();
    const partner = await studio();
    const airing = await createAnime({ posterUrl: 'p', status: 'Currently Airing', type: 'TV', year: 2026, members: 10 });
    const finished = await createAnime({ posterUrl: 'p', status: 'Finished Airing', type: 'TV', year: 2020, score: 8.5, members: 50_000 });
    const movie = await createAnime({ posterUrl: 'p', status: 'Finished Airing', type: 'Movie', year: 2020, members: 5 });
    await prisma.animeStudio.createMany({
      data: [
        { animeId: airing.id, studioId: s.id },
        { animeId: finished.id, studioId: s.id },
        { animeId: movie.id, studioId: s.id, role: 'CO_PRODUCER' },
        { animeId: finished.id, studioId: partner.id },
      ],
    });

    const p = await getStudioProfile(s.slug!);
    assert.ok(p);
    assert.equal(p!.stats.works, 3);
    assert.equal(p!.stats.airing, 1, 'only the currently-airing show counts');
    assert.equal(p!.stats.firstYear, 2020);
    assert.deepEqual(p!.timeline, [
      { year: 2020, count: 2 },
      ...[2021, 2022, 2023, 2024, 2025].map((year) => ({ year, count: 0 })),
      { year: 2026, count: 1 },
    ]);
    assert.deepEqual(p!.formats, [{ type: 'TV', count: 2 }, { type: 'Movie', count: 1 }]);
    assert.equal(p!.works.find((w) => w.id === movie.id)!.credit, 'Co-producer');
    assert.equal(p!.location, null, 'the schema default "Japan" alone is not shown');
    assert.equal(p!.logoUrl, null);
    assert.deepEqual(p!.partners.map((x) => ({ id: x.id, shared: x.shared })), [{ id: partner.id, shared: 1 }]);
  });

  test('logo, location and links show once an admin fills them in; unsafe URLs are dropped', async () => {
    const s = await studio({ city: 'Suginami', region: 'Tokyo', imageUrl: 'https://img.test/logo.png', website: 'javascript:alert(1)', wikipediaUrl: 'https://en.wikipedia.org/wiki/X' });
    const p = await getStudioProfile(s.slug!);
    assert.equal(p!.logoUrl, 'https://img.test/logo.png');
    assert.equal(p!.location, 'Suginami, Tokyo, Japan');
    assert.deepEqual(p!.links.map((l) => l.label), ['Wikipedia']);
  });

  test('hidden and merged studios 404; old slugs resolve through redirects', async () => {
    const hidden = await studio({ publicationState: 'HIDDEN' });
    assert.equal(await getStudioProfile(hidden.slug!), null);
    const live = await studio();
    await prisma.studioRedirect.create({ data: { sourceIdentifier: `old-${live.slug}`, canonicalStudioId: live.id } });
    assert.equal((await getStudioProfile(`old-${live.slug}`))?.id, live.id);
  });
});

describe('creator page data', () => {
  test('studios worked with comes from their credits', async () => {
    const s = await studio();
    const a = await createAnime({ posterUrl: 'p', year: 2010 });
    const b = await createAnime({ posterUrl: 'p', year: 2012 });
    await prisma.animeStudio.createMany({ data: [{ animeId: a.id, studioId: s.id }, { animeId: b.id, studioId: s.id }] });
    const person = await prisma.person.create({ data: { name: `Person ${uid()}`, slug: `person-${uid()}` } });
    await prisma.animeStaff.createMany({ data: [{ animeId: a.id, personId: person.id, role: 'Director' }, { animeId: b.id, personId: person.id, role: 'Director' }] });

    const p = await getCreatorProfile(person.slug!);
    assert.deepEqual(p!.studiosWorkedWith.map((x) => ({ id: x.id, works: x.works })), [{ id: s.id, works: 2 }]);
  });

  test('provider "no photo" stand-ins are recognised', () => {
    assert.ok(isProviderPlaceholderImage('https://s4.anilist.co/file/anilistcdn/staff/large/default.jpg'));
    assert.ok(isProviderPlaceholderImage('https://cdn.myanimelist.net/images/questionmark_23.gif?s=abc'));
    assert.ok(!isProviderPlaceholderImage('https://s4.anilist.co/file/anilistcdn/staff/large/n95185-x.jpg'));
  });
});
