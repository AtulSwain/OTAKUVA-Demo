/**
 * Posters for the /welcome landing page's moving background: the catalog's
 * most-watched (non-adult) titles that have a poster. Real catalog art only.
 * AniList covers are served at their ~230px "medium" size here — the tiles
 * are small and there are dozens of them, so the ~460px file would make the
 * page several MB heavier for no visible gain.
 */
import { unstable_cache } from 'next/cache';
import { prisma } from '../prisma';

export interface LandingPoster {
  id: string;
  title: string;
  src: string;
}

const smaller = (url: string) => url.replace('/media/anime/cover/large/', '/media/anime/cover/medium/');

async function loadLandingPosters(limit: number): Promise<LandingPoster[]> {
  const rows = await prisma.anime.findMany({
    where: {
      isAdult: false,
      posterUrl: { startsWith: 'https://' },
      status: { not: 'MERGED' },
      // First impression of the site: no fan-service covers in the background.
      animeGenres: { none: { genre: { name: { in: ['Ecchi', 'Hentai', 'Erotica'] } } } },
    },
    orderBy: { members: { sort: 'desc', nulls: 'last' } },
    take: limit,
    select: { id: true, canonicalTitle: true, posterUrl: true },
  });
  return rows.map((r) => ({ id: r.id, title: r.canonicalTitle, src: smaller(r.posterUrl as string) }));
}

export const getLandingPosters = unstable_cache(loadLandingPosters, ['landing-posters-v2'], { revalidate: 3600 });
