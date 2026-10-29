/**
 * Every studio with at least one (non-adult) anime in the catalog, for the
 * /studios directory (2026-10-28 rebuild). One SQL query instead of the old
 * per-request studioService call that took 1–8s and returned only 24 rows.
 * Cached for 10 minutes; everything shown comes from stored rows.
 */
import { unstable_cache } from 'next/cache';
import { prisma } from '../prisma';
import { sanitizePublicEntityName } from '../normalizers';

export interface DirectoryStudio {
  id: string;
  slug: string;
  name: string;
  nativeName: string | null;
  logoUrl: string | null;
  foundedYear: number | null;
  closed: boolean;
  city: string | null;
  works: number;
  firstYear: number | null;
  latestYear: number | null;
  /** Posters of its three most-watched works. */
  posters: string[];
  knownFor: string | null;
}

type Row = {
  id: string;
  slug: string | null;
  name: string;
  override_name: string | null;
  native_name: string | null;
  logo: string | null;
  founded: number | null;
  status: string;
  city: string | null;
  works: number;
  first_year: number | null;
  latest_year: number | null;
  posters: (string | null)[] | null;
  known_for: string | null;
};

const LOCAL_LOGO = /^\/brand\/studios\/[\w-]+\.(png|jpe?g|webp)$/;
const safeLogo = (raw: string | null) => {
  if (!raw) return null;
  if (LOCAL_LOGO.test(raw)) return raw;
  if (/^\/(uploads|api\/media)\/[\w./-]+$/.test(raw) && !raw.includes('..')) return raw;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
};

export async function buildStudioDirectory(): Promise<DirectoryStudio[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    WITH w AS (
      SELECT x."studioId" AS sid, a."posterUrl" AS poster, a."canonicalTitle" AS title,
             COALESCE(a.year, a."startYear") AS y,
             ROW_NUMBER() OVER (PARTITION BY x."studioId" ORDER BY a.members DESC NULLS LAST, a.id) AS rn
      FROM "AnimeStudio" x
      JOIN "Anime" a ON a.id = x."animeId"
      WHERE a."isAdult" = false AND a.status <> 'MERGED'
    )
    SELECT s.id, s.slug, s.name, s."adminOverrideName" AS override_name, s."nativeName" AS native_name,
           COALESCE(s."adminOverrideImageUrl", s."imageUrl") AS logo,
           COALESCE(s."adminOverrideFoundedYear", s."foundedYear") AS founded,
           s.status, s.city,
           COUNT(*)::int AS works,
           MIN(w.y)::int AS first_year, MAX(w.y)::int AS latest_year,
           (ARRAY_AGG(w.poster ORDER BY w.rn) FILTER (WHERE w.rn <= 3 AND w.poster IS NOT NULL)) AS posters,
           MAX(w.title) FILTER (WHERE w.rn = 1) AS known_for
    FROM "Studio" s
    JOIN w ON w.sid = s.id
    WHERE s."publicationState" = 'PUBLISHED' AND s.status <> 'MERGED'
    GROUP BY s.id
    ORDER BY works DESC, s.name ASC
  `;
  return rows.flatMap((r): DirectoryStudio[] => {
    const name = sanitizePublicEntityName(r.override_name || r.name) || r.name;
    if (!name) return [];
    const posters = (r.posters || []).filter((p): p is string => typeof p === 'string' && /^https?:\/\//.test(p));
    return [
      {
        id: r.id,
        slug: r.slug || r.id,
        name,
        nativeName: r.native_name && r.native_name !== name ? r.native_name : null,
        logoUrl: safeLogo(r.logo),
        foundedYear: r.founded,
        closed: r.status === 'CLOSED' || r.status === 'INACTIVE',
        city: r.city,
        works: r.works,
        firstYear: r.first_year && r.first_year > 1900 ? r.first_year : null,
        latestYear: r.latest_year && r.latest_year > 1900 ? r.latest_year : null,
        posters: posters.slice(0, 3),
        knownFor: r.known_for ? sanitizePublicEntityName(r.known_for) || null : null,
      },
    ];
  });
}

const cachedDirectory = unstable_cache(buildStudioDirectory, ['studio-directory-v1'], { revalidate: 600, tags: ['studio-directory'] });

// Also kept in process memory: re-reading ~0.5 MB from Next's data cache on
// every search keystroke cost ~2s; from memory a page is a few ms.
const MEMO_MS = 10 * 60 * 1000;
let memo: { at: number; data: Promise<DirectoryStudio[]> } | null = null;
/** Drops the in-memory copy (the control center calls this after a change). */
export function resetStudioDirectoryMemo() {
  memo = null;
}
export function getStudioDirectory(): Promise<DirectoryStudio[]> {
  if (!memo || Date.now() - memo.at > MEMO_MS) {
    const data = cachedDirectory().catch((e) => {
      memo = null;
      throw e;
    });
    memo = { at: Date.now(), data };
  }
  return memo.data;
}

export type DirectorySort = 'works' | 'name' | 'oldest' | 'newest' | 'active';
export type DirectoryStatus = 'all' | 'active' | 'closed';

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9぀-ヿ㐀-鿿]+/g, ' ').trim();

/** One page of the directory, searched/sorted/filtered over the cached list. */
export async function queryStudioDirectory(opts: { q?: string; sort?: DirectorySort; status?: DirectoryStatus; offset?: number; limit?: number }) {
  const all = await getStudioDirectory();
  const q = fold(opts.q || '');
  let list = all;
  if (q) {
    list = list.filter((s) => fold(`${s.name} ${s.nativeName || ''}`).includes(q));
    // Names that start with the query first.
    list = [...list].sort((a, b) => Number(fold(b.name).startsWith(q)) - Number(fold(a.name).startsWith(q)));
  }
  if (opts.status === 'active') list = list.filter((s) => !s.closed);
  if (opts.status === 'closed') list = list.filter((s) => s.closed);
  const sort = opts.sort || 'works';
  if (!q || sort !== 'works') {
    const byWorks = (a: DirectoryStudio, b: DirectoryStudio) => b.works - a.works || a.name.localeCompare(b.name);
    const cmp: Record<DirectorySort, (a: DirectoryStudio, b: DirectoryStudio) => number> = {
      works: byWorks,
      name: (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
      // Studios without a founding year go last for the founding sorts.
      oldest: (a, b) => (a.foundedYear ?? 9999) - (b.foundedYear ?? 9999) || byWorks(a, b),
      newest: (a, b) => (b.foundedYear ?? -1) - (a.foundedYear ?? -1) || byWorks(a, b),
      active: (a, b) => (b.latestYear ?? -1) - (a.latestYear ?? -1) || byWorks(a, b),
    };
    list = [...list].sort(cmp[sort] || byWorks);
  }
  const offset = Math.max(0, opts.offset || 0);
  const limit = Math.min(96, Math.max(1, opts.limit || 48));
  return { total: list.length, studios: list.slice(offset, offset + limit) };
}

export interface FoundingDecade {
  decade: number;
  count: number;
  studios: { slug: string; name: string; logoUrl: string | null; foundedYear: number; works: number }[];
}

/** Studios grouped by the decade they were founded in (only studios with a recorded founding year). */
export async function getFoundingTimeline(perDecade = 8): Promise<FoundingDecade[]> {
  const all = await getStudioDirectory();
  const map = new Map<number, DirectoryStudio[]>();
  for (const s of all) {
    if (!s.foundedYear) continue;
    const d = Math.floor(s.foundedYear / 10) * 10;
    map.set(d, [...(map.get(d) || []), s]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, list]) => ({
      decade,
      count: list.length,
      studios: [...list]
        .sort((a, b) => b.works - a.works)
        .slice(0, perDecade)
        .map((s) => ({ slug: s.slug, name: s.name, logoUrl: s.logoUrl, foundedYear: s.foundedYear as number, works: s.works })),
    }));
}

export async function getStudioDirectoryStats() {
  const all = await getStudioDirectory();
  return {
    studios: all.length,
    founded: all.filter((s) => s.foundedYear).length,
    active: all.filter((s) => !s.closed).length,
    closed: all.filter((s) => s.closed).length,
  };
}
