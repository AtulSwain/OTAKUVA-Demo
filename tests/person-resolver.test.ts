import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { resolveStaffPerson, linkStaffToAnime } from '../src/lib/people/personResolver';
import { plainTextBio } from '../src/lib/providers/anilistProvider';
import { createAnime } from './helpers/fixtures';

after(async () => {
  await prisma.$disconnect();
});

const staff = (id: number, name: string, role = 'Director') => ({
  personExternalId: String(id),
  personName: name,
  personKanji: null,
  personImage: null,
  positions: [role],
});

describe('resolveStaffPerson', () => {
  test('the same AniList person twice is one row', async () => {
    const a = await resolveStaffPerson(staff(5001, 'Creator Once'), 'anilist');
    const b = await resolveStaffPerson(staff(5001, 'Creator Once'), 'anilist');
    assert.equal(a, b);
    assert.equal(await prisma.person.count({ where: { anilistId: 5001 } }), 1);
  });

  test('two different people who share a name stay two people', async () => {
    const a = await resolveStaffPerson(staff(5101, 'Shared Name'), 'anilist');
    const b = await resolveStaffPerson(staff(5102, 'Shared Name'), 'anilist');
    assert.notEqual(a, b);
    const second = await prisma.person.findUniqueOrThrow({ where: { id: b! } });
    assert.equal(second.slug, 'shared-name-5102');
    const first = await prisma.person.findUniqueOrThrow({ where: { id: a! } });
    assert.equal(first.anilistId, 5101);
  });

  test('an existing name-only person gets the id attached instead of a duplicate', async () => {
    const legacy = await prisma.person.create({ data: { name: 'Legacy Person', slug: 'legacy-person' } });
    const id = await resolveStaffPerson(staff(5201, 'Legacy Person'), 'anilist');
    assert.equal(id, legacy.id);
    assert.equal((await prisma.person.findUniqueOrThrow({ where: { id: legacy.id } })).anilistId, 5201);
  });

  test('an AniList id and a MAL id for the same name join one person', async () => {
    const a = await resolveStaffPerson(staff(5301, 'Two Providers'), 'anilist');
    const b = await resolveStaffPerson(staff(9301, 'Two Providers'), 'jikan');
    assert.equal(a, b);
    const p = await prisma.person.findUniqueOrThrow({ where: { id: a! } });
    assert.equal(p.anilistId, 5301);
    assert.equal(p.malId, 9301);
  });

  test('linkStaffToAnime adds a credit once and can match people without adding credits', async () => {
    const anime = await createAnime();
    await linkStaffToAnime(anime.id, [staff(5401, 'Credit Person')], 'anilist');
    await linkStaffToAnime(anime.id, [staff(5401, 'Credit Person')], 'anilist');
    assert.equal(await prisma.animeStaff.count({ where: { animeId: anime.id } }), 1);
    const { creditsAdded } = await linkStaffToAnime(anime.id, [staff(5402, 'Matched Only')], 'anilist', { addCredits: false });
    assert.equal(creditsAdded, 0);
    assert.equal(await prisma.person.count({ where: { anilistId: 5402 } }), 1);
  });
});

describe('plainTextBio', () => {
  test('strips markdown and html, keeps link text, drops spoilers', () => {
    const out = plainTextBio('__Born:__ Tokyo<br>Known for [Frieren](https://anilist.co/anime/1).~!Secret ending!~ Done.');
    assert.equal(out, 'Born: Tokyo\nKnown for Frieren. Done.');
  });
  test('drops lines that are only links', () => {
    assert.equal(plainTextBio('[Wiki (jp)](https://ja.wikipedia.org/x) | [Twitter](https://x.com/y)\n\nAffiliated with a studio.'), 'Affiliated with a studio.');
  });
  test('drops link-list lines with nested brackets and bare labels', () => {
    assert.equal(plainTextBio('Website | Twitter | [YouTube [ano]](https://y.com/a) | [YouTube [Ano-chan]](https://y.com/b)\nSinger.'), 'Singer.');
  });
  test('keeps prose that mentions a link', () => {
    assert.equal(plainTextBio('She sang the [opening](https://x.com) of the show.'), 'She sang the opening of the show.');
    assert.equal(plainTextBio('Read more [here](https://x.com)'), 'Read more here');
    assert.equal(plainTextBio('Drums | Guitar'), 'Drums | Guitar');
  });
  test('drops html link lists that arrive as bare labels', () => {
    assert.equal(plainTextBio('<a href="a">Website</a> | <a href="b">Twitter</a> | <a href="c">Instagram</a> (run by staff)<br>A band.'), 'A band.');
    assert.equal(plainTextBio('<a href="a">Profile</a> (agehasprings) | <a href="b">Twitter</a>\nComposer.'), 'Composer.');
    assert.equal(plainTextBio('__[Website](http://a.com/)__ | __[Twitter](https://t.com/b)__\n\n__Introduction:__\nA duo.'), 'Introduction:\nA duo.');
  });
  test('empty stays null', () => {
    assert.equal(plainTextBio(''), null);
    assert.equal(plainTextBio(null), null);
  });
});
