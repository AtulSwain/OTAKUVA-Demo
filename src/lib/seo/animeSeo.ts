/**
 * Search-engine data for an anime page (2026-11-02): title, description,
 * share image and schema.org JSON-LD — all from stored facts only. Nothing
 * here is invented: no score is claimed in structured data, missing fields
 * are just left out.
 */
import * as React from 'react';
import type { Metadata } from 'next';
import { prisma } from '../prisma';
import { SITE_NAME, absoluteUrl, metaDescription, shareImage } from './site';

const FORMAT_LABEL: Record<string, string> = {
  TV: 'TV series',
  TV_SHORT: 'TV short',
  TV_SPECIAL: 'TV special',
  MOVIE: 'Movie',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'Special',
  MUSIC: 'Music video',
};

// One DB read per request even though metadata and the page both ask
// (React's request cache; outside Next — e.g. tests — it just runs).
const perRequest: <T extends (...a: any[]) => any>(fn: T) => T = (React as any).cache ?? ((fn: any) => fn);

export const getAnimeSeo = perRequest(async (idOrSlug: string) => {
  const anime = await prisma.anime.findFirst({
    where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
    select: {
      id: true,
      slug: true,
      canonicalTitle: true,
      synopsis: true,
      type: true,
      status: true,
      year: true,
      episodes: true,
      startDate: true,
      endDate: true,
      isAdult: true,
      posterUrl: true,
      bannerUrl: true,
      titles: { where: { type: { in: ['english', 'japanese'] } }, select: { type: true, title: true } },
      animeGenres: { select: { genre: { select: { name: true } } } },
      animeStudios: { where: { isMain: true }, select: { studio: { select: { name: true, slug: true } } }, take: 3 },
    },
  });
  return anime;
});

type AnimeSeo = NonNullable<Awaited<ReturnType<typeof getAnimeSeo>>>;

const englishTitle = (a: AnimeSeo) => a.titles.find((t) => t.type === 'english' && t.title !== a.canonicalTitle)?.title ?? null;

function factsLine(a: AnimeSeo): string {
  const studio = a.animeStudios[0]?.studio.name;
  return [
    FORMAT_LABEL[a.type] ?? a.type,
    a.year ? String(a.year) : null,
    a.episodes && a.type !== 'MOVIE' ? `${a.episodes} episodes` : null,
    studio ? `by ${studio}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function animeMetadata(a: AnimeSeo | null): Metadata {
  if (!a) return { title: 'Anime not found', robots: { index: false, follow: false } };
  const en = englishTitle(a);
  const name = en ? `${a.canonicalTitle} (${en})` : a.canonicalTitle;
  const facts = factsLine(a);
  const synopsis = metaDescription(a.synopsis, 150);
  const description = synopsis ? `${facts}. ${synopsis}` : `${facts}. Track it, rate every episode and read reviews on ${SITE_NAME}.`;
  const image = shareImage(a.bannerUrl) ?? shareImage(a.posterUrl);
  const path = `/anime/${a.slug}`;
  return {
    title: name,
    description: metaDescription(description, 200) ?? undefined,
    alternates: { canonical: path },
    // Adult titles are reachable but never indexed.
    robots: a.isAdult ? { index: false, follow: false } : undefined,
    openGraph: {
      type: a.type === 'MOVIE' ? 'video.movie' : 'video.tv_show',
      url: path,
      title: name,
      description: synopsis ?? facts,
      images: image ? [{ url: image, alt: a.canonicalTitle }] : undefined,
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: name, description: synopsis ?? facts, images: image ? [image] : undefined },
  };
}

export function animeJsonLd(a: AnimeSeo): Record<string, unknown>[] {
  const url = absoluteUrl(`/anime/${a.slug}`);
  const en = englishTitle(a);
  const jp = a.titles.find((t) => t.type === 'japanese')?.title;
  const isMovie = a.type === 'MOVIE';
  const item: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    name: a.canonicalTitle,
    url,
  };
  const alt = [en, jp].filter((t): t is string => Boolean(t));
  if (alt.length) item.alternateName = alt;
  const desc = metaDescription(a.synopsis, 500);
  if (desc) item.description = desc;
  const img = shareImage(a.posterUrl);
  if (img) item.image = img;
  if (a.startDate) item[isMovie ? 'datePublished' : 'startDate'] = a.startDate.toISOString().slice(0, 10);
  if (!isMovie && a.endDate) item.endDate = a.endDate.toISOString().slice(0, 10);
  if (!isMovie && a.episodes) item.numberOfEpisodes = a.episodes;
  const genres = a.animeGenres.map((g) => g.genre.name);
  if (genres.length) item.genre = genres;
  const studios = a.animeStudios.filter((s) => s.studio.slug);
  if (studios.length) {
    item.productionCompany = studios.map((s) => ({ '@type': 'Organization', name: s.studio.name, url: absoluteUrl(`/studio/${s.studio.slug}`) }));
  }
  item.inLanguage = 'ja';

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Anime', item: absoluteUrl('/anime') },
      { '@type': 'ListItem', position: 2, name: a.canonicalTitle, item: url },
    ],
  };
  return [item, crumbs];
}
