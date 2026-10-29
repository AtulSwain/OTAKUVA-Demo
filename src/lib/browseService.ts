/**
 * Server-side data for /browse and /api/browse. Reads the canonical Prisma
 * catalog only — no provider calls at request time (missing curated titles
 * are imported ahead of time by scripts/resolve_curated.ts).
 */

import { prisma } from './prisma';
import { searchAnimeIdsByTitle } from './fuzzySearch';
import { sanitizePublicEntityName } from './normalizers';
import { AWARDS, OTAKUVA_CHOICE, CuratedEntry } from './curated';
import {
  BROWSE_FORMATS,
  BROWSE_GENRES,
  FAMILY_EXCLUDED_GENRES,
  FAMILY_EXCLUDED_THEMES,
  BrowseFilters,
  BrowseItem,
  BrowseTabId,
  tabLimit,
} from './browse';
import { formatAnimeStatus } from './anime/animeStatus';
import { getPublishedChoice } from '@control/lib/charts';

const include = {
  animeGenres: { include: { genre: true } },
  animeThemes: { include: { theme: true } },
  ratingAggregate: { select: { rawAverage: true, ratingCount: true } },
} as const;

function truncate(text: string, max: number): string {
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40))}…`;
}

/** Shared label ("Finished" / "Airing" / "Not yet aired"); '' when unknown
 *  — this used to call unknown statuses "Completed". */
function statusLabel(status?: string | null): string {
  return formatAnimeStatus(status) ?? '';
}

function toItem(a: any, label: string, extra: Partial<BrowseItem> = {}): BrowseItem | null {
  const title = sanitizePublicEntityName(a.canonicalTitle);
  if (!title || !a.posterUrl || a.isAdult) return null;
  return {
    id: a.id,
    slug: a.slug,
    title,
    posterUrl: a.posterUrl,
    bannerUrl: a.bannerUrl ?? null,
    year: a.year ?? a.seasonYear ?? null,
    format: a.type,
    genres: (a.animeGenres || []).map((g: any) => g.genre.name).slice(0, 3),
    score: typeof a.score === 'number' ? a.score : null,
    otakuvaScore:
      a.ratingAggregate?.ratingCount > 0 && typeof a.ratingAggregate.rawAverage === 'number'
        ? a.ratingAggregate.rawAverage
        : null,
    status: statusLabel(a.status),
    synopsis: truncate(a.synopsis || '', 220),
    label,
    ...extra,
  };
}

function baseWhere(f: BrowseFilters): any {
  const where: any = { status: { not: 'MERGED' }, isAdult: false, posterUrl: { not: '' } };
  const and: any[] = [];
  if (f.genre) and.push({ animeGenres: { some: { genre: { name: f.genre } } } });
  if (f.format) and.push({ type: { in: [...(BROWSE_FORMATS.find((x) => x.id === f.format)?.db ?? [])] } });
  if (f.country) and.push({ country: f.country });
  if (f.family) {
    and.push({ NOT: { animeGenres: { some: { genre: { name: { in: FAMILY_EXCLUDED_GENRES } } } } } });
    and.push({ NOT: { animeThemes: { some: { theme: { name: { in: FAMILY_EXCLUDED_THEMES } } } } } });
  }
  if (and.length) where.AND = and;
  return where;
}

/** Applies the same filters as the DB query, in code, to curated lists. */
function passesFilters(a: any, f: BrowseFilters): boolean {
  const genres: string[] = (a.animeGenres || []).map((g: any) => g.genre.name);
  const themes: string[] = (a.animeThemes || []).map((t: any) => t.theme.name);
  if (f.genre && !genres.includes(f.genre)) return false;
  if (f.format && !(BROWSE_FORMATS.find((x) => x.id === f.format)?.db as readonly string[] | undefined)?.includes(a.type)) return false;
  if (f.country && a.country !== f.country) return false;
  if (f.family && (genres.some((g) => FAMILY_EXCLUDED_GENRES.includes(g)) || themes.some((t) => FAMILY_EXCLUDED_THEMES.includes(t)))) return false;
  return true;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Finds one catalog anime for a curated entry, or null (never guesses loosely). */
export async function findCuratedAnime(entry: CuratedEntry): Promise<any | null> {
  const matches = await searchAnimeIdsByTitle(entry.search, 12);
  if (matches.length === 0) return null;
  const rankById = new Map(matches.map((m) => [m.id, Number(m.rank)]));
  const rows = await prisma.anime.findMany({
    where: { id: { in: matches.map((m) => m.id) }, isAdult: false, status: { not: 'MERGED' } },
    include: { ...include, titles: { select: { title: true } } },
  });
  const want = norm(entry.search);
  const candidates = rows
    .filter((a: any) => !entry.format || a.type.toLowerCase() === entry.format.toLowerCase())
    .filter((a: any) => !entry.year || a.year === entry.year || a.seasonYear === entry.year)
    .map((a: any) => {
      const names = [a.canonicalTitle, ...a.titles.map((t: any) => t.title)].map(norm);
      const exact = names.includes(want);
      const contains = names.some((n: string) => n.includes(want));
      return { a, exact, contains, rank: rankById.get(a.id) ?? 0 };
    })
    .filter((c) => c.exact || c.contains);
  if (candidates.length === 0) return null;
  candidates.sort(
    (x, y) =>
      Number(y.exact) - Number(x.exact) ||
      x.a.canonicalTitle.length - y.a.canonicalTitle.length ||
      y.rank - x.rank
  );
  return candidates[0].a;
}

const FINISHED = ['Finished', 'Finished Airing'];

/** One list for a browse category. `limit` defaults to the category's own length. */
export async function getBrowseList(tab: BrowseTabId, filters: BrowseFilters, limit?: number): Promise<BrowseItem[]> {
  const take = Math.max(1, Math.min(limit ?? tabLimit(tab), tabLimit(tab)));

  if (tab !== 'choice' && tab !== 'awards') {
    const where = baseWhere(filters);
    let orderBy: any = { members: 'desc' };
    if (tab === 'rated' || tab === 'top100') {
      where.members = { gt: 50000 };
      where.score = { not: null };
      orderBy = [{ score: { sort: 'desc', nulls: 'last' } }, { members: 'desc' }];
    } else if (tab === 'monthly') {
      where.status = { in: ['Airing', 'Currently Airing'] };
    } else if (tab === 'binge') {
      // Completed TV series short enough to finish quickly, well rated and widely watched.
      where.type = 'TV';
      where.status = { in: FINISHED };
      where.episodes = { gte: 12, lte: 52 };
      where.score = { gte: 7.5 };
      where.members = { gte: 100000 };
      orderBy = [{ score: { sort: 'desc', nulls: 'last' } }, { members: 'desc' }];
    } else if (tab === 'movies') {
      where.type = 'Movie';
      where.members = { gt: 30000 };
      where.score = { not: null };
      orderBy = [{ score: { sort: 'desc', nulls: 'last' } }, { members: 'desc' }];
    } else if (tab === 'gems') {
      where.score = { gte: 7.8 };
      where.members = { gte: 15000, lte: 200000 };
      orderBy = [{ score: { sort: 'desc', nulls: 'last' } }, { members: 'desc' }];
    }
    const rows = await prisma.anime.findMany({ where, orderBy, take, include });
    return rows.flatMap((a: any, i: number) => toItem(a, String(i + 1)) ?? []);
  }

  // OTAKUVA Choice made in the control center (2026-10-28) replaces the
  // hand-edited list in curated.ts once it's published with entries.
  if (tab === 'choice') {
    const published = await getPublishedChoice();
    if (published) {
      const rows = await prisma.anime.findMany({ where: { id: { in: published.map((p) => p.animeId) } }, include });
      const byId = new Map(rows.map((r: any) => [r.id, r]));
      const out: BrowseItem[] = [];
      for (const p of published) {
        const a = byId.get(p.animeId);
        if (!a || !passesFilters(a, filters)) continue;
        const item = toItem(a, String(out.length + 1), { note: p.note ?? undefined });
        if (item) out.push(item);
      }
      return out.slice(0, take);
    }
  }

  const entries: Array<{ entry: CuratedEntry; label?: string; caption?: string }> =
    tab === 'choice'
      ? OTAKUVA_CHOICE.map((entry) => ({ entry }))
      : AWARDS.map((entry) => ({ entry, label: String(entry.ceremonyYear), caption: `${entry.award} · Crunchyroll Anime Awards ${entry.ceremonyYear}` }));

  const found = await Promise.all(entries.map(({ entry }) => findCuratedAnime(entry)));
  const items: BrowseItem[] = [];
  found.forEach((a, idx) => {
    if (!a || !passesFilters(a, filters)) return;
    const { entry, label, caption } = entries[idx];
    const item = toItem(a, label ?? String(items.length + 1), { caption, note: entry.note });
    if (item) items.push(item);
  });
  if (tab === 'choice') items.forEach((it, i) => (it.label = String(i + 1)));
  return items.slice(0, take);
}

export interface GenreArtwork {
  genre: string;
  imageUrl: string | null;
  /** Title the artwork comes from, for the alt/credit text. */
  fromTitle: string | null;
  count: number;
}

async function imageLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    return res.ok && (res.headers.get('content-type') || '').startsWith('image');
  } catch {
    return false;
  }
}

let genreCache: { at: number; value: GenreArtwork[] } | null = null;
/** Drops the cached genre artwork (the control center calls this after a change). */
export function resetGenreArtworkCache() {
  genreCache = null;
}
const GENRE_CACHE_MS = 60 * 60 * 1000;

/**
 * One real image per genre: the most-followed non-adult title in that genre
 * that has wide artwork, never reusing a title across genres. Nothing is
 * invented — a genre with no artwork gets `imageUrl: null` and the UI falls
 * back to a plain gradient.
 */
export async function getGenreArtwork(): Promise<GenreArtwork[]> {
  if (genreCache && Date.now() - genreCache.at < GENRE_CACHE_MS) return genreCache.value;

  const used = new Set<string>();
  const out: GenreArtwork[] = [];
  for (const genre of BROWSE_GENRES) {
    const genreWhere = { animeGenres: { some: { genre: { name: genre } } } };
    const [count, candidates] = await Promise.all([
      prisma.anime.count({ where: { status: { not: 'MERGED' }, isAdult: false, ...genreWhere } }),
      prisma.anime.findMany({
        where: {
          status: { not: 'MERGED' },
          isAdult: false,
          id: { notIn: [...used] },
          bannerUrl: { not: null },
          ...genreWhere,
        },
        orderBy: { members: { sort: 'desc', nulls: 'last' } },
        take: 6,
        select: { id: true, canonicalTitle: true, bannerUrl: true },
      }),
    ]);
    // Stored banner URLs go stale; take the first one that actually loads.
    let pick: (typeof candidates)[number] | undefined;
    for (const c of candidates) {
      if (c.bannerUrl && (await imageLoads(c.bannerUrl))) { pick = c; break; }
    }
    if (pick) used.add(pick.id);
    out.push({
      genre,
      imageUrl: pick?.bannerUrl ?? null,
      fromTitle: pick ? sanitizePublicEntityName(pick.canonicalTitle) : null,
      count,
    });
  }
  genreCache = { at: Date.now(), value: out };
  return out;
}

/** One anime as a BrowseItem (e.g. the homepage's daily OTAKUVA Choice pick). */
export async function getBrowseItemById(id: string, extra: Partial<BrowseItem> = {}): Promise<BrowseItem | null> {
  const a = await prisma.anime.findUnique({ where: { id }, include });
  return a ? toItem(a, '1', extra) : null;
}
