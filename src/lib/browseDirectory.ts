import { prisma } from './prisma';
import { getGenreArtwork, type GenreArtwork } from './browseService';

/**
 * Browse = a directory of ways into the catalog (genres, formats, seasons,
 * decades, themes), each with a real title count and a link to the matching
 * filtered page. Its job is "show me horror / movies / the 90s"; Top Picks
 * (/top-picks) is the ranked, curated lists; Explore (/anime) is search.
 */
const baseWhere = { status: { not: 'MERGED' }, isAdult: false } as const;

export interface DirectoryTile {
  key: string;
  label: string;
  count: number;
  href: string;
  hint?: string;
}

export interface BrowseDirectory {
  genres: GenreArtwork[];
  formats: DirectoryTile[];
  seasons: DirectoryTile[];
  decades: DirectoryTile[];
  themes: DirectoryTile[];
}

const FORMATS = [
  { key: 'TV', label: 'TV Series', db: ['TV', 'TV_SHORT'], hint: 'Weekly series' },
  { key: 'Movie', label: 'Movies', db: ['Movie'], hint: 'Feature films' },
  { key: 'OVA', label: 'OVA', db: ['OVA'], hint: 'Straight-to-video' },
  { key: 'ONA', label: 'ONA', db: ['ONA'], hint: 'Released online' },
  { key: 'Special', label: 'Specials', db: ['Special', 'TV Special', 'TV_SPECIAL'], hint: 'One-offs & extras' },
];

const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'] as const;

function seasonAt(offset: number, now = new Date()) {
  const idx = Math.floor(now.getMonth() / 3) + offset;
  const year = now.getFullYear() + Math.floor(idx / 4);
  const season = SEASONS[((idx % 4) + 4) % 4];
  return { season, year };
}

// Same rule as the catalog's decade filter (animeCatalogEngine), so counts match.
const yearRange = (from: number, to: number) => ({
  OR: [{ year: { gte: from, lte: to } }, { startYear: { gte: from, lte: to } }],
});

export async function getBrowseDirectory(): Promise<BrowseDirectory> {
  const seasonDefs = [
    { ...seasonAt(-1), hint: 'Last season' },
    { ...seasonAt(0), hint: 'Airing now' },
    { ...seasonAt(1), hint: 'Coming next' },
  ];
  const thisDecade = Math.floor(new Date().getFullYear() / 10) * 10;
  const decadeStarts = [0, 1, 2, 3, 4, 5].map((i) => thisDecade - i * 10);

  const [genres, formatCounts, seasonCounts, decadeCounts, themeRows] = await Promise.all([
    getGenreArtwork(),
    Promise.all(FORMATS.map((f) => prisma.anime.count({ where: { ...baseWhere, type: { in: f.db } } }))),
    Promise.all(
      seasonDefs.map((s) =>
        prisma.anime.count({ where: { ...baseWhere, season: { equals: s.season, mode: 'insensitive' }, year: s.year } })
      )
    ),
    Promise.all(decadeStarts.map((d) => prisma.anime.count({ where: { ...baseWhere, ...yearRange(d, d + 9) } }))),
    prisma.theme.findMany({
      select: { name: true, slug: true, _count: { select: { animeThemes: true } } },
      orderBy: { animeThemes: { _count: 'desc' } },
      take: 16,
    }),
  ]);

  return {
    genres,
    formats: FORMATS.map((f, i) => ({
      key: f.key,
      label: f.label,
      hint: f.hint,
      count: formatCounts[i],
      href: `/anime?type=${encodeURIComponent(f.key)}`,
    })),
    seasons: seasonDefs.map((s, i) => ({
      key: `${s.season}-${s.year}`,
      label: `${s.season} ${s.year}`,
      hint: s.hint,
      count: seasonCounts[i],
      href: `/seasonal?season=${s.season}&year=${s.year}`,
    })),
    decades: decadeStarts
      .map((d, i) => ({ key: `${d}s`, label: `${d}s`, count: decadeCounts[i], href: `/anime?year=${d}s` }))
      .filter((d) => d.count > 0),
    themes: themeRows
      .filter((t) => t._count.animeThemes > 0)
      .map((t) => ({ key: t.slug, label: t.name, count: t._count.animeThemes, href: `/theme/${t.slug}` })),
  };
}
