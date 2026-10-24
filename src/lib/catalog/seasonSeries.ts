import { prisma } from '../prisma';
import { getAnimeDisplayTitle } from '../animeTitleResolver';

/**
 * A show's seasons, for the season bar on the anime page.
 *
 * In this catalog every season is its own Anime row (as in AniList/MAL), so
 * "the seasons of X" are found by walking Sequel/Prequel relations in both
 * directions. The walk goes through every format — Demon Slayer's chain runs
 * TV → movie → TV — and the result is then split into TV/ONA seasons and
 * everything else (films, OVAs, specials). Ordered by air date.
 *
 * Labels come from the real titles (the part after the shared series name:
 * "Season 2", "Final Season Part 2"), never from a counted index, which
 * would mislabel split cours.
 */

export interface SeriesEntry {
  id: string;
  slug: string;
  title: string;
  /** Short label for the bar, derived from the title. */
  label: string;
  type: string;
  year: number | null;
  episodes: number | null;
  posterUrl: string | null;
  isCurrent: boolean;
}

export interface SeasonSeries {
  seasons: SeriesEntry[];
  /** Films, OVAs and specials in the same sequel/prequel chain. */
  extras: SeriesEntry[];
}

const CHAIN_TYPES = ['Sequel', 'Prequel'];
const SEASON_TYPES = new Set(['TV', 'ONA', 'TV_SHORT']);
const MAX_NODES = 60;

/** Curly quotes and the like differ between providers ("Journey's" vs "Journey’s"). */
function normalizeTitle(t: string): string {
  return t.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
}

function commonPrefix(titles: string[]): string {
  if (titles.length < 2) return '';
  let prefix = titles[0];
  for (const t of titles.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < t.length && prefix[i].toLowerCase() === t[i].toLowerCase()) i++;
    prefix = prefix.slice(0, i);
  }
  // Back off to a word boundary so "Attack on Tita" never becomes the base.
  const boundary = prefix.search(/[\s:\-–—]+[^\s:\-–—]*$/);
  const complete = titles.some((t) => t.length === prefix.length) || /[\s:\-–—]$/.test(prefix);
  return complete ? prefix : boundary > 0 ? prefix.slice(0, boundary) : '';
}

function stripBase(title: string, base: string): string | null {
  if (base.trim().length < 3 || title.length <= base.length) return null;
  if (title.slice(0, base.length).toLowerCase() !== base.toLowerCase()) return null;
  const rest = title.slice(base.length).replace(/^[\s:\-–—]+/, '').trim();
  return rest || null;
}

/**
 * Label relative to the first season's title when a season's title extends
 * it ("Frieren" → "Season 2"), else relative to the prefix all titles share,
 * else the full title (e.g. a sequel only known by its romaji name).
 */
function labelFor(title: string, rootTitle: string, sharedBase: string, isFirst: boolean, hasRelativeLabels: boolean): string {
  if (isFirst) return hasRelativeLabels ? 'Season 1' : title;
  return stripBase(title, rootTitle) ?? stripBase(title, sharedBase) ?? title;
}

export async function getSeasonSeries(animeId: string): Promise<SeasonSeries> {
  // Breadth-first over Sequel/Prequel links, stored in either direction.
  const seen = new Set<string>([animeId]);
  // "after" edges: [earlier, later], from Sequel/Prequel links in either direction.
  const order: Array<[string, string]> = [];
  let frontier = [animeId];
  while (frontier.length > 0 && seen.size < MAX_NODES) {
    const links = await prisma.animeRelation.findMany({
      where: {
        relationType: { in: CHAIN_TYPES },
        OR: [{ sourceAnimeId: { in: frontier } }, { targetAnimeId: { in: frontier } }],
      },
      select: { sourceAnimeId: true, targetAnimeId: true, relationType: true },
    });
    const next: string[] = [];
    for (const l of links) {
      order.push(l.relationType === 'Sequel' ? [l.sourceAnimeId, l.targetAnimeId] : [l.targetAnimeId, l.sourceAnimeId]);
      for (const id of [l.sourceAnimeId, l.targetAnimeId]) {
        if (!seen.has(id) && seen.size < MAX_NODES) {
          seen.add(id);
          next.push(id);
        }
      }
    }
    frontier = next;
  }
  if (seen.size < 2) return { seasons: [], extras: [] };

  const rows = await prisma.anime.findMany({
    where: { id: { in: Array.from(seen) }, status: { not: 'MERGED' }, isAdult: false },
    select: {
      id: true,
      slug: true,
      canonicalTitle: true,
      type: true,
      year: true,
      seasonYear: true,
      episodes: true,
      posterUrl: true,
      airedFrom: true,
      startDate: true,
    },
  });

  const when = (r: (typeof rows)[number]) =>
    (r.airedFrom ?? r.startDate)?.getTime() ?? (r.year ?? r.seasonYear ? Date.UTC((r.year ?? r.seasonYear) as number, 0, 1) : Number.MAX_SAFE_INTEGER);
  // Order by the sequel chain itself (Kahn's topological sort), using air
  // date only to break ties — some records carry wrong dates, and the
  // chain is the more reliable signal of which season comes first.
  const ids = new Set(rows.map((r) => r.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const indeg = new Map(rows.map((r) => [r.id, 0]));
  const out = new Map<string, Set<string>>();
  for (const [a, b] of order) {
    if (!ids.has(a) || !ids.has(b) || a === b) continue;
    const set = out.get(a) ?? new Set<string>();
    if (!set.has(b)) {
      set.add(b);
      out.set(a, set);
      indeg.set(b, (indeg.get(b) ?? 0) + 1);
    }
  }
  const byDate = (x: string, y: string) => when(byId.get(x)!) - when(byId.get(y)!);
  const ready = rows.filter((r) => indeg.get(r.id) === 0).map((r) => r.id).sort(byDate);
  const sorted: typeof rows = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    sorted.push(byId.get(id)!);
    for (const nxt of Array.from(out.get(id) ?? [])) {
      indeg.set(nxt, (indeg.get(nxt) ?? 0) - 1);
      if (indeg.get(nxt) === 0) {
        ready.push(nxt);
        ready.sort(byDate);
      }
    }
  }
  // Anything left (a cycle in bad data) goes last, by date.
  const placed = new Set(sorted.map((r) => r.id));
  rows.splice(0, rows.length, ...sorted, ...rows.filter((r) => !placed.has(r.id)).sort((x, y) => byDate(x.id, y.id)));

  const toEntries = (list: typeof rows): SeriesEntry[] => {
    const titled = list.map((r) => ({ r, title: normalizeTitle(getAnimeDisplayTitle(r as any) || r.canonicalTitle) }));
    const base = commonPrefix(titled.map((t) => t.title));
    const root = titled[0]?.title ?? '';
    const hasRelative = titled.slice(1).some((t) => stripBase(t.title, root) !== null || stripBase(t.title, base) !== null);
    return titled.map(({ r, title }, i) => ({
      id: r.id,
      slug: r.slug,
      title,
      label: labelFor(title, root, base, i === 0, hasRelative),
      type: r.type,
      year: r.year ?? r.seasonYear ?? (r.airedFrom ?? r.startDate)?.getUTCFullYear() ?? null,
      episodes: r.episodes ?? null,
      posterUrl: r.posterUrl || null,
      isCurrent: r.id === animeId,
    }));
  };

  return {
    seasons: toEntries(rows.filter((r) => SEASON_TYPES.has(String(r.type).toUpperCase()))),
    extras: toEntries(rows.filter((r) => !SEASON_TYPES.has(String(r.type).toUpperCase()))),
  };
}
