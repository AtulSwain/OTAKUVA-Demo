import { prisma } from '../prisma';

/**
 * Creator profile (a Person) built only from stored rows. Replaces the old
 * /api/people/[slug] lookup, which (a) fell back to a fuzzy `name contains`
 * match that could open a different person, and (b) pulled a "biography"
 * live from Danbooru by name — Danbooru catalogues illustrators, so a
 * same-named artist's wiki could be shown as this person's bio.
 */

/** "Key Animation (eps 3, 7)" → "Key Animation"; "Director, Storyboard" → both. */
export function roleNames(role: string): string[] {
  return role
    .split(/,(?![^(]*\))/)
    .map((r) => r.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean);
}

// Headline jobs first when a person had several on one anime.
const ROLE_PRIORITY = [
  'Chief Director', 'Director', 'Original Creator', 'Original Story', 'Series Composition', 'Script',
  'Character Design', 'Original Character Design', 'Music', 'Animation Director', 'Chief Animation Director',
  'Art Director', 'Sound Director', 'Storyboard', 'Episode Director', 'Key Animation', 'Producer',
];
const rolePriority = (r: string) => {
  const i = ROLE_PRIORITY.findIndex((p) => p.toLowerCase() === r.toLowerCase());
  return i === -1 ? ROLE_PRIORITY.length : i;
};

/** Creative credits counted for "Frequent collaborators". */
const COLLABORATOR_ROLES = [
  'Director',
  'Original Creator',
  'Series Composition',
  'Script',
  'Character Design',
  'Chief Animation Director',
  'Music',
  'Art Director',
  'Storyboard',
  'Sound Director',
];

export interface CreatorCredit {
  anime: {
    id: string;
    slug: string;
    title: string;
    posterUrl: string | null;
    year: number | null;
    type: string | null;
    score: number | null;
    members: number | null;
  };
  roles: string[];
}

export async function getCreatorProfile(slugOrId: string) {
  const key = decodeURIComponent(slugOrId).trim();
  const include = {
    staffRoles: {
      include: {
        anime: {
          select: {
            id: true,
            slug: true,
            canonicalTitle: true,
            posterUrl: true,
            year: true,
            startYear: true,
            type: true,
            score: true,
            members: true,
            status: true,
            isAdult: true,
            animeGenres: { select: { genre: { select: { name: true } } } },
          },
        },
      },
    },
    voiceRoles: {
      include: {
        character: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            animeRoles: {
              take: 1,
              orderBy: { anime: { members: { sort: 'desc' as const, nulls: 'last' as const } } },
              select: { role: true, anime: { select: { slug: true, canonicalTitle: true, year: true, startYear: true } } },
            },
          },
        },
      },
    },
    studioRelations: {
      orderBy: [{ isCurrent: 'desc' as const }, { role: 'asc' as const }],
      include: { studio: { select: { id: true, name: true, slug: true, imageUrl: true } } },
    },
  };

  const person =
    (await prisma.person.findFirst({ where: { OR: [{ slug: key }, { id: key }] }, include })) ??
    // Exact (case-insensitive) name only — never a partial match, which
    // could land on someone else.
    (await prisma.person.findFirst({ where: { name: { equals: key.replace(/-/g, ' '), mode: 'insensitive' } }, include }));
  if (!person) return null;

  // One entry per anime, every role they had on it.
  const byAnime = new Map<string, CreatorCredit>();
  for (const sr of person.staffRoles) {
    if (sr.anime.status === 'MERGED') continue;
    const entry =
      byAnime.get(sr.anime.id) ??
      {
        anime: {
          id: sr.anime.id,
          slug: sr.anime.slug,
          title: sr.anime.canonicalTitle,
          posterUrl: sr.anime.posterUrl,
          year: sr.anime.year ?? sr.anime.startYear ?? null,
          type: sr.anime.type,
          score: sr.anime.score,
          members: sr.anime.members,
        },
        roles: [],
      };
    for (const r of roleNames(sr.role)) if (!entry.roles.includes(r)) entry.roles.push(r);
    byAnime.set(sr.anime.id, entry);
  }
  for (const c of byAnime.values()) c.roles.sort((a, b) => rolePriority(a) - rolePriority(b));
  const credits = [...byAnime.values()].sort((a, b) => (b.anime.year ?? 0) - (a.anime.year ?? 0) || a.anime.title.localeCompare(b.anime.title));

  const roleCounts = new Map<string, number>();
  for (const c of credits) for (const r of c.roles) roleCounts.set(r, (roleCounts.get(r) || 0) + 1);
  const topRoles = [...roleCounts.entries()].sort((a, b) => b[1] - a[1]).map(([role, count]) => ({ role, count }));

  const knownFor = [...credits]
    .filter((c) => c.anime.members)
    .sort((a, b) => (b.anime.members ?? 0) - (a.anime.members ?? 0))
    .slice(0, 6);

  const years = credits.map((c) => c.anime.year).filter((y): y is number => typeof y === 'number' && y > 1900);

  // Genres across their credited anime (each anime counted once).
  const animeGenres = new Map<string, string[]>();
  for (const sr of person.staffRoles) {
    if (sr.anime.status === 'MERGED' || sr.anime.isAdult) continue;
    animeGenres.set(sr.anime.id, sr.anime.animeGenres.map((g) => g.genre.name).filter((g) => !['Hentai', 'Erotica'].includes(g)));
  }
  const genreCounts = new Map<string, number>();
  for (const list of animeGenres.values()) for (const g of list) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  const genres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count }));

  // Studios behind the anime they're credited on, and the people they most
  // often share a credit with — both straight from the catalog.
  const creditIds = credits.map((c) => c.anime.id);
  const [studioRows, collaboratorRows] = creditIds.length
    ? await Promise.all([
        prisma.animeStudio.groupBy({
          by: ['studioId'],
          where: { animeId: { in: creditIds }, studio: { publicationState: 'PUBLISHED', status: { not: 'MERGED' } } },
          _count: { animeId: true },
          orderBy: { _count: { animeId: 'desc' } },
          take: 8,
        }),
        prisma.animeStaff.groupBy({
          by: ['personId'],
          where: { animeId: { in: creditIds }, personId: { not: person.id }, role: { in: COLLABORATOR_ROLES } },
          _count: { animeId: true },
          orderBy: { _count: { animeId: 'desc' } },
          take: 24,
        }),
      ])
    : [[], []];
  const [studioInfo, collaboratorInfo] = await Promise.all([
    studioRows.length
      ? prisma.studio.findMany({
          where: { id: { in: studioRows.map((r) => r.studioId) } },
          select: { id: true, slug: true, name: true, adminOverrideName: true, imageUrl: true, adminOverrideImageUrl: true },
        })
      : Promise.resolve([]),
    collaboratorRows.length
      ? prisma.person.findMany({
          where: { id: { in: collaboratorRows.map((r) => r.personId) }, slug: { not: null } },
          select: { id: true, slug: true, name: true, imageUrl: true, staffRoles: { where: { animeId: { in: creditIds }, role: { in: COLLABORATOR_ROLES } }, select: { role: true } } },
        })
      : Promise.resolve([]),
  ]);
  const studioCount = new Map(studioRows.map((r) => [r.studioId, r._count.animeId]));
  const collabCount = new Map(collaboratorRows.map((r) => [r.personId, r._count.animeId]));
  const studiosWorkedWith = studioInfo
    .map((st) => ({
      id: st.id,
      slug: st.slug,
      name: st.adminOverrideName || st.name,
      logoUrl: st.adminOverrideImageUrl || st.imageUrl,
      works: studioCount.get(st.id) ?? 0,
    }))
    .sort((a, b) => b.works - a.works);
  const collaborators = collaboratorInfo
    .map((c) => {
      const counts = new Map<string, number>();
      for (const r of c.staffRoles) counts.set(r.role, (counts.get(r.role) ?? 0) + 1);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        imageUrl: c.imageUrl,
        shared: collabCount.get(c.id) ?? 0,
        role: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => r).join(' / '),
      };
    })
    .filter((c) => c.shared >= 2)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 12);

  const voiceRoles = person.voiceRoles.map((vr) => {
    const ar = vr.character.animeRoles[0];
    return {
      characterId: vr.character.id,
      characterName: vr.character.name,
      characterSlug: vr.character.slug,
      characterImage: vr.character.imageUrl,
      language: vr.language,
      role: ar?.role ?? null,
      anime: ar ? { slug: ar.anime.slug, title: ar.anime.canonicalTitle, year: ar.anime.year ?? ar.anime.startYear ?? null } : null,
    };
  });

  return {
    id: person.id,
    name: person.name,
    slug: person.slug,
    nameKanji: person.nameKanji,
    imageUrl: person.imageUrl,
    about: person.about,
    birthday: person.birthday,
    dateOfDeath: person.dateOfDeath,
    homeTown: person.homeTown,
    yearsActive: person.yearsActive,
    occupations: person.occupations ?? [],
    alternativeNames: (person.alternativeNames ?? []).filter((n) => n !== person.name && n !== person.nameKanji),
    gender: person.gender,
    bloodType: person.bloodType,
    language: person.language,
    favourites: person.anilistFavourites,
    website: person.website,
    anilistId: person.anilistId,
    malId: person.malId,
    credits,
    topRoles,
    knownFor,
    stats: {
      works: credits.length,
      firstYear: years.length ? Math.min(...years) : null,
      latestYear: years.length ? Math.max(...years) : null,
      voiceRoles: voiceRoles.length,
    },
    voiceRoles,
    genres,
    studiosWorkedWith,
    collaborators,
    studioAffiliations: person.studioRelations.map((sp) => ({
      studioId: sp.studio.id,
      studioName: sp.studio.name,
      studioSlug: sp.studio.slug,
      studioImageUrl: sp.studio.imageUrl,
      role: sp.role,
      tenureStartYear: sp.tenureStartYear,
      tenureEndYear: sp.tenureEndYear,
      isCurrent: sp.isCurrent,
    })),
  };
}

export type CreatorProfile = NonNullable<Awaited<ReturnType<typeof getCreatorProfile>>>;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "1975-07-29" → "July 29, 1975"; "--07-29" → "July 29"; "1975-07" → "July 1975". */
export function formatFuzzyDate(value: string | null | undefined): string | null {
  if (!value) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
  m = /^--(\d{2})-(\d{2})$/.exec(value);
  if (m) return `${MONTHS[+m[1] - 1]} ${+m[2]}`;
  m = /^(\d{4})-(\d{2})$/.exec(value);
  if (m) return `${MONTHS[+m[2] - 1]} ${m[1]}`;
  if (/^\d{4}$/.test(value)) return value;
  return value; // legacy free-text values are shown as stored
}

/** Age in whole years from a full birth date (to the death date if there is one). */
export function ageFrom(birth: string | null | undefined, death?: string | null, now = new Date()): number | null {
  const b = birth && /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!b) return null;
  const d = death && /^(\d{4})-(\d{2})-(\d{2})$/.exec(death);
  if (death && !d) return null;
  const end = d ? new Date(+d[1], +d[2] - 1, +d[3]) : now;
  let age = end.getFullYear() - +b[1];
  if (end.getMonth() + 1 < +b[2] || (end.getMonth() + 1 === +b[2] && end.getDate() < +b[3])) age--;
  return age >= 0 && age < 130 ? age : null;
}
