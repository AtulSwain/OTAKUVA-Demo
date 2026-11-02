import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { createAnime } from './helpers/fixtures';
import { jsonLdString, metaDescription } from '../src/lib/seo/site';
import { animeJsonLd, animeMetadata, getAnimeSeo } from '../src/lib/seo/animeSeo';
import robots from '../src/app/robots';
import sitemap, { generateSitemaps } from '../src/app/sitemap';
import { SITEMAP_IDS } from '../src/lib/seo/sitemapPlan';

after(async () => {
  await prisma.$disconnect();
});

describe('SEO', () => {
  test('meta descriptions are plain text, cut at a word, never invented', () => {
    assert.equal(metaDescription(null), null);
    assert.equal(metaDescription('   '), null);
    assert.equal(metaDescription('<b>Hello</b>   world'), 'Hello world');
    const long = metaDescription('word '.repeat(100), 50)!;
    assert.ok(long.length <= 50 && long.endsWith('…'), long);
    assert.equal(metaDescription('A story. (Source: Crunchyroll)'), 'A story.');
  });

  test('JSON-LD cannot break out of its script tag', () => {
    assert.doesNotMatch(jsonLdString({ name: '</script><script>alert(1)</script>' }), /<\/script>/i);
  });

  test('robots.txt lists every sitemap part, keeps private areas out, and never names the control center', () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const disallow = ([] as string[]).concat(rule.disallow ?? []);
    for (const p of ['/api/', '/library', '/settings']) assert.ok(disallow.includes(p), p);
    assert.ok(!JSON.stringify(r).includes('/control'));
    assert.equal(([] as string[]).concat(r.sitemap ?? []).length, SITEMAP_IDS.length);
  });

  test('sitemap lists anime pages but never adult titles', async () => {
    const ok = await createAnime({ canonicalTitle: 'SEO Visible Show' });
    const adult = await createAnime({ canonicalTitle: 'SEO Adult Show' });
    await prisma.anime.update({ where: { id: adult.id }, data: { isAdult: true } });

    const ids = await generateSitemaps();
    assert.equal(ids.length, SITEMAP_IDS.length);
    const animePart = await sitemap({ id: 1 });
    const urls = animePart.map((e) => e.url);
    assert.ok(urls.some((u) => u.endsWith(`/anime/${ok.slug}`)));
    assert.ok(!urls.some((u) => u.endsWith(`/anime/${adult.slug}`)));
    assert.ok((await sitemap({ id: 0 })).some((e) => /\/schedule$/.test(e.url)));
    assert.deepEqual(await sitemap({ id: 999 }), []);
  });

  test('anime metadata: canonical slug URL, adult titles noindex, no invented score in JSON-LD', async () => {
    const a = await createAnime({ canonicalTitle: 'SEO Meta Show' });
    const seo = await getAnimeSeo(a.id);
    assert.ok(seo);
    const meta = animeMetadata(seo);
    assert.equal((meta.alternates as any).canonical, `/anime/${a.slug}`);
    assert.equal(meta.robots, undefined);
    const ld = JSON.stringify(animeJsonLd(seo!));
    assert.doesNotMatch(ld, /aggregateRating|ratingValue/);

    await prisma.anime.update({ where: { id: a.id }, data: { isAdult: true } });
    const adultMeta = animeMetadata(await getAnimeSeo(a.slug));
    assert.deepEqual(adultMeta.robots, { index: false, follow: false });
    assert.deepEqual(animeMetadata(null).robots, { index: false, follow: false });
  });
});
