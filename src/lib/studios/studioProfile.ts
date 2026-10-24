/**
 * Everything the public studio page shows (2026-10-19 redesign), in one
 * server-side load. Built from the catalog itself — the studio's works, the
 * people credited on them, their genres and years, studios that co-produced
 * them — plus whatever editorial fields an admin has filled in (logo,
 * description, founded year, website…). Missing editorial data is simply
 * left off; nothing here is invented.
 */
import { prisma } from '../prisma';
import { sanitizePublicEntityName } from '../normalizers';
import { classifyAnimeStatus } from '../anime/animeStatus';

const ADULT_GENRES = ['Hentai', 'Erotica'];

/** Credits that make someone a creative lead on a show, for "People behind the work". */
export const STUDIO_CREATIVE_ROLES = [
  'Director',
  'Original Creator',
  'Series Composition',
  'Script',
  'Character Design',
  'Chief Animation Director',
  'Music',
  'Art Director',
];

/** Same lookup order as studioService.getStudioBySlugOrId: slug/id/name, then redirects, then aliases. */
async function resolveStudioId(slugOrId: string): Promise<string | null> {
  const clean = decodeURIComponent(slugOrId).trim();
  const listed = { publicationState: 'PUBLISHED', status: { not: 'MERGED' } };
  const direct = await prisma.studio.findFirst({
    where: { ...listed, OR: [{ slug: clean }, { id: clean }, { name: clean }, { slug: clean.toLowerCase() }] },
    select: { id: true },
  });
  if (direct) return direct.id;
  const redirect = await prisma.studioRedirect.findUnique({ where: { sourceIdentifier: clean }, select: { canonicalStudioId: true } });
  if (redirect) return redirect.canonicalStudioId;
  const norm = clean.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const alias = await prisma.studioAlias.findFirst({ where: { normalizedAlias: norm }, select: { studioId: true } });
  return alias?.studioId ?? null;
}

function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface StudioWork {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  type: string | null;
  year: number | null;
  score: number | null;
  members: number | null;
  status: string | null;
  episodes: number | null;
  genres: string[];
  /** "Main studio", "Co-producer"… as credited. */
  credit: string;
}

const CREDIT_LABEL: Record<string, string> = {
  MAIN_STUDIO: 'Main studio',
  ANIMATION: 'Animation',
  CO_PRODUCER: 'Co-producer',
  PRODUCTION_ASSISTANCE: 'Production assistance',
  CG: 'CG',
  BACKGROUND: 'Backgrounds',
  OTHER: 'Other',
};

const normType = (t: string | null) => {
  const v = String(t || '').replace(/_/g, ' ').toUpperCase();
  if (v === 'MOVIE') return 'Movie';
  if (v === 'OVA' || v === 'ONA') return v;
  if (v.includes('SPECIAL')) return 'Special';
  if (v === 'MUSIC') return 'Music';
  return v ? 'TV' : null;
};

export async function getStudioProfile(slugOrId: string) {
  const id = await resolveStudioId(slugOrId);
  if (!id) return null;

  const studio = await prisma.studio.findUnique({
    where: { id },
    include: {
      animeStudios: {
        where: { anime: { status: { not: 'MERGED' }, isAdult: false } },
        select: {
          role: true,
          anime: {
            select: {
              id: true,
              slug: true,
              canonicalTitle: true,
              posterUrl: true,
              type: true,
              year: true,
              startYear: true,
              score: true,
              members: true,
              status: true,
              episodes: true,
              animeGenres: { select: { genre: { select: { name: true } } } },
            },
          },
        },
      },
      communities: {
        where: { status: 'ACTIVE', deletedAt: null, visibility: { in: ['PUBLIC', 'REQUEST_TO_JOIN'] } },
        select: { id: true, name: true, slug: true, iconUrl: true, memberCount: true },
        orderBy: { memberCount: 'desc' },
        take: 4,
      },
      newsRelations: {
        where: { article: { status: 'PUBLISHED', deletedAt: null } },
        orderBy: { article: { publishedAt: 'desc' } },
        take: 4,
        select: { article: { select: { id: true, slug: true, title: true, adminOverrideTitle: true, publishedAt: true, sourceName: true } } },
      },
    },
  });
  if (!studio || studio.status === 'MERGED' || studio.publicationState !== 'PUBLISHED') return null;

  const works: StudioWork[] = studio.animeStudios.flatMap((as): StudioWork[] => {
      const a = as.anime;
      const title = sanitizePublicEntityName(a.canonicalTitle);
      if (!title || !a.slug) return [];
      return [{
        id: a.id,
        slug: a.slug,
        title,
        posterUrl: a.posterUrl || null,
        type: normType(a.type),
        year: a.year ?? a.startYear ?? null,
        score: a.score,
        members: a.members,
        status: a.status,
        episodes: a.episodes,
        genres: a.animeGenres.map((g) => g.genre.name).filter((g) => !ADULT_GENRES.includes(g)),
        credit: CREDIT_LABEL[as.role] ?? 'Studio',
      }];
    });

  const workIds = works.map((w) => w.id);
  const years = works.map((w) => w.year).filter((y): y is number => typeof y === 'number' && y > 1900);
  const scored = works.filter((w) => typeof w.score === 'number');

  // Per-year output, oldest to newest, every year in between included.
  const perYear = new Map<number, number>();
  for (const y of years) perYear.set(y, (perYear.get(y) ?? 0) + 1);
  const firstYear = years.length ? Math.min(...years) : null;
  const latestYear = years.length ? Math.max(...years) : null;
  const timeline =
    firstYear !== null && latestYear !== null
      ? Array.from({ length: latestYear - firstYear + 1 }, (_, i) => ({ year: firstYear + i, count: perYear.get(firstYear + i) ?? 0 }))
      : [];

  const genreCounts = new Map<string, number>();
  for (const w of works) for (const g of w.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  const genres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count }));

  const formatCounts = new Map<string, number>();
  for (const w of works) if (w.type) formatCounts.set(w.type, (formatCounts.get(w.type) ?? 0) + 1);
  const formats = [...formatCounts.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));

  const [peopleRows, partnerRows] = workIds.length
    ? await Promise.all([
        // Creative leads credited on this studio's work, by how many of its shows they worked on.
        prisma.animeStaff.groupBy({
          by: ['personId'],
          where: { animeId: { in: workIds }, role: { in: STUDIO_CREATIVE_ROLES } },
          _count: { animeId: true },
          orderBy: { _count: { animeId: 'desc' } },
          take: 30,
        }),
        // Other studios credited on the same shows.
        prisma.animeStudio.groupBy({
          by: ['studioId'],
          where: { animeId: { in: workIds }, studioId: { not: studio.id }, studio: { publicationState: 'PUBLISHED', status: { not: 'MERGED' } } },
          _count: { animeId: true },
          orderBy: { _count: { animeId: 'desc' } },
          take: 6,
        }),
      ])
    : [[], []];

  const [people, partners] = await Promise.all([
    peopleRows.length
      ? prisma.person.findMany({
          where: { id: { in: peopleRows.map((r) => r.personId) }, slug: { not: null } },
          select: {
            id: true,
            slug: true,
            name: true,
            imageUrl: true,
            staffRoles: { where: { animeId: { in: workIds }, role: { in: STUDIO_CREATIVE_ROLES } }, select: { role: true } },
          },
        })
      : Promise.resolve([]),
    partnerRows.length
      ? prisma.studio.findMany({
          where: { id: { in: partnerRows.map((r) => r.studioId) } },
          select: { id: true, slug: true, name: true, adminOverrideName: true, imageUrl: true, adminOverrideImageUrl: true },
        })
      : Promise.resolve([]),
  ]);
  const peopleCount = new Map(peopleRows.map((r) => [r.personId, r._count.animeId]));
  const partnerCount = new Map(partnerRows.map((r) => [r.studioId, r._count.animeId]));

  const bySize = (a: StudioWork, b: StudioWork) => (b.members ?? 0) - (a.members ?? 0);
  const name = sanitizePublicEntityName(studio.adminOverrideName || studio.name) || studio.name;
  let aliases: string[] = [];
  try {
    const parsed = studio.alternativeNamesJson ? JSON.parse(studio.alternativeNamesJson) : [];
    if (Array.isArray(parsed)) aliases = parsed.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 4);
  } catch {
    aliases = [];
  }

  return {
    id: studio.id,
    slug: studio.slug,
    name,
    nativeName: studio.nativeName,
    aliases,
    /** Official logo once an admin adds one; the page shows initials until then. */
    logoUrl: safeUrl(studio.adminOverrideImageUrl || studio.imageUrl),
    bannerUrl: safeUrl(studio.bannerUrl),
    description: studio.adminOverrideDescription || studio.about || studio.shortDescription || null,
    foundedYear: studio.adminOverrideFoundedYear ?? studio.foundedYear ?? null,
    closed: ['CLOSED', 'INACTIVE'].includes(studio.status),
    // The schema defaults country to "Japan" for every row, so a location is
    // only shown when someone actually recorded a city or region.
    location: studio.city || studio.region ? [studio.city, studio.region, studio.country].filter(Boolean).join(', ') : null,
    verified: studio.verificationStatus === 'VERIFIED',
    links: [
      { label: 'Official site', url: safeUrl(studio.adminOverrideWebsite || studio.website) },
      { label: 'Wikipedia', url: safeUrl(studio.wikipediaUrl) },
      { label: 'X / Twitter', url: safeUrl(studio.twitterUrl) },
      { label: 'YouTube', url: safeUrl(studio.youtubeUrl) },
    ].filter((l): l is { label: string; url: string } => Boolean(l.url)),
    stats: {
      works: works.length,
      firstYear,
      latestYear,
      airing: works.filter((w) => classifyAnimeStatus(w.status) === 'airing').length,
      /** Mean provider (MyAnimeList/AniList) score of the scored works. */
      averageScore: scored.length ? scored.reduce((s, w) => s + (w.score as number), 0) / scored.length : null,
      scoredWorks: scored.length,
    },
    formats,
    genres,
    timeline,
    knownFor: [...works].sort(bySize).slice(0, 6),
    topRated: [...scored].filter((w) => (w.members ?? 0) >= 20000).sort((a, b) => (b.score as number) - (a.score as number)).slice(0, 5),
    works: [...works].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || bySize(a, b)),
    people: people
      .map((p) => {
        const counts = new Map<string, number>();
        for (const r of p.staffRoles) counts.set(r.role, (counts.get(r.role) ?? 0) + 1);
        return {
          id: p.id,
          slug: p.slug!,
          name: p.name,
          imageUrl: p.imageUrl,
          works: peopleCount.get(p.id) ?? 0,
          role: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => r).join(' / '),
        };
      })
      .sort((a, b) => b.works - a.works)
      .slice(0, 12),
    partners: partners
      .map((s) => ({
        id: s.id,
        slug: s.slug,
        name: sanitizePublicEntityName(s.adminOverrideName || s.name) || s.name,
        logoUrl: safeUrl(s.adminOverrideImageUrl || s.imageUrl),
        shared: partnerCount.get(s.id) ?? 0,
      }))
      .sort((a, b) => b.shared - a.shared),
    communities: studio.communities,
    news: studio.newsRelations.map((n) => ({
      id: n.article.id,
      slug: n.article.slug,
      title: n.article.adminOverrideTitle || n.article.title,
      date: n.article.publishedAt.toISOString(),
      source: n.article.sourceName,
    })),
  };
}

export type StudioProfile = NonNullable<Awaited<ReturnType<typeof getStudioProfile>>>;
