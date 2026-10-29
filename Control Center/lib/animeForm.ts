/**
 * The anime form (2026-10-28): every field the public anime page shows, as
 * questions to fill in. Creates a new (manual) anime or edits an existing
 * one. On an existing anime every changed field is also recorded as an
 * EditorialOverride, so provider sync never replaces it (syncEngine skips any
 * overridden field). Changes are logged to AnimeMetadataHistory.
 */
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/normalizers';
import { CacheManager } from '@/lib/performance/cacheManager';
import { cleanImageUrl, cleanTrailerUrl } from './access';
import { ControlEditError } from './editor';

export const ANIME_TYPES = ['TV', 'Movie', 'ONA', 'OVA', 'Special', 'TV Special'];
export const ANIME_STATUSES = ['Not Yet Aired', 'Airing', 'Finished', 'Hiatus', 'Cancelled'];
export const ANIME_SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'];
export const ANIME_SOURCES = ['Original', 'Manga', 'Web manga', 'Light Novel', 'Novel', 'Visual Novel', 'Video Game', 'Other'];
export const AGE_RATINGS = ['G - All Ages', 'PG - Children', 'PG-13 - Teens 13 or older', 'R - 17+ (violence & profanity)', 'R+ - Mild Nudity'];
export const WEEKDAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

export interface AnimeFormValues {
  canonicalTitle: string;
  englishTitle: string;
  romajiTitle: string;
  nativeTitle: string;
  synonyms: string[];
  synopsis: string;
  background: string;
  type: string;
  status: string;
  source: string;
  episodes: number | null;
  duration: string;
  rating: string;
  season: string;
  seasonYear: number | null;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  broadcastDay: string;
  broadcastTime: string;
  country: string;
  posterUrl: string;
  bannerUrl: string;
  trailerUrl: string;
  anilistId: number | null;
  malId: number | null;
  genreIds: string[];
  themeIds: string[];
  studios: { id: string; name: string; isMain: boolean }[];
  streaming: { provider: string; url: string }[];
}

export async function getFormOptions() {
  const [genres, themes] = await Promise.all([
    prisma.genre.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.theme.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return {
    genres: genres.filter((g) => !['Hentai', 'Erotica'].includes(g.name)),
    themes,
    types: ANIME_TYPES,
    statuses: ANIME_STATUSES,
    seasons: ANIME_SEASONS,
    sources: ANIME_SOURCES,
    ratings: AGE_RATINGS,
    weekdays: WEEKDAYS,
  };
}

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
const pickTitle = (titles: { type: string; title: string; language: string | null }[], ...types: string[]) =>
  titles.find((t) => types.includes(t.type))?.title ?? '';

export async function getAnimeForm(id: string): Promise<{ id: string; slug: string; values: AnimeFormValues; overrides: string[]; externalSource: string } | null> {
  const a = await prisma.anime.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      titles: { select: { type: true, title: true, language: true } },
      animeGenres: { select: { genreId: true } },
      animeThemes: { select: { themeId: true } },
      animeStudios: { select: { isMain: true, studio: { select: { id: true, name: true } } } },
      streamingAvailability: { select: { provider: true, url: true } },
    },
  });
  if (!a) return null;
  const overrides = await prisma.editorialOverride.findMany({ where: { entityType: 'ANIME', entityId: a.id }, select: { field: true } });
  return {
    id: a.id,
    slug: a.slug,
    externalSource: a.externalSource,
    overrides: overrides.map((o) => o.field),
    values: {
      canonicalTitle: a.canonicalTitle,
      englishTitle: pickTitle(a.titles, 'english'),
      romajiTitle: pickTitle(a.titles, 'romaji'),
      nativeTitle: pickTitle(a.titles, 'japanese', 'native'),
      synonyms: a.titles.filter((t) => t.type === 'synonym').map((t) => t.title).slice(0, 20),
      synopsis: a.synopsis || '',
      background: a.background || '',
      type: a.type || '',
      status: a.status || '',
      source: a.source || '',
      episodes: a.episodes ?? null,
      duration: a.duration || '',
      rating: a.rating || '',
      season: a.season || '',
      seasonYear: a.seasonYear ?? null,
      startDate: ymd(a.startDate ?? a.airedFrom),
      endDate: ymd(a.endDate ?? a.airedTo),
      broadcastDay: a.broadcastDay || '',
      broadcastTime: a.broadcastTime || '',
      country: a.country || '',
      posterUrl: a.posterUrl || '',
      bannerUrl: a.bannerUrl || '',
      trailerUrl: a.trailerUrl || '',
      anilistId: a.anilistId ?? null,
      malId: a.malId ?? null,
      genreIds: a.animeGenres.map((g) => g.genreId),
      themeIds: a.animeThemes.map((t) => t.themeId),
      studios: a.animeStudios.map((s) => ({ id: s.studio.id, name: s.studio.name, isMain: s.isMain })),
      streaming: a.streamingAvailability.filter((s) => s.url).map((s) => ({ provider: s.provider, url: s.url as string })),
    },
  };
}

// ── validation ──────────────────────────────────────────────────────────
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const oneOf = (v: unknown, list: string[], label: string) => {
  const s = str(v, 60);
  if (s && !list.includes(s)) throw new ControlEditError(400, `${label}: choose one of the options.`);
  return s;
};
const int = (v: unknown, min: number, max: number, label: string) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ControlEditError(400, `${label} must be a whole number from ${min} to ${max}.`);
  return n;
};
const date = (v: unknown, label: string) => {
  const s = str(v, 10);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw new ControlEditError(400, `${label} must be a date.`);
  return new Date(`${s}T00:00:00Z`);
};
const httpsUrl = (v: unknown) => {
  const s = str(v, 500);
  try {
    return new URL(s).protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
};

function validate(raw: Partial<Record<keyof AnimeFormValues, unknown>>) {
  const canonicalTitle = str(raw.canonicalTitle, 300).replace(/\s+/g, ' ');
  if (!canonicalTitle) throw new ControlEditError(400, 'The main title is required.');
  const poster = cleanImageUrl(raw.posterUrl ?? '');
  if (poster === undefined) throw new ControlEditError(400, 'Poster must be an https:// image link or an uploaded file.');
  const banner = cleanImageUrl(raw.bannerUrl ?? '');
  if (banner === undefined) throw new ControlEditError(400, 'Banner must be an https:// image link or an uploaded file.');
  const trailer = cleanTrailerUrl(raw.trailerUrl ?? '');
  if (trailer === undefined) throw new ControlEditError(400, 'Trailer must be a YouTube link.');
  const startDate = date(raw.startDate, 'Start date');
  const endDate = date(raw.endDate, 'End date');
  if (startDate && endDate && endDate < startDate) throw new ControlEditError(400, 'End date is before the start date.');
  const time = str(raw.broadcastTime, 5);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ControlEditError(400, 'Broadcast time must look like 23:30.');
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length < 40))].slice(0, 30) : []);
  const studios = Array.isArray(raw.studios)
    ? raw.studios
        .filter((s: any) => s && typeof s.id === 'string')
        .slice(0, 12)
        .map((s: any) => ({ id: s.id as string, isMain: Boolean(s.isMain) }))
    : [];
  const streaming = Array.isArray(raw.streaming)
    ? raw.streaming
        .map((s: any) => ({ provider: str(s?.provider, 60), url: httpsUrl(s?.url) }))
        .filter((s): s is { provider: string; url: string } => Boolean(s.provider && s.url))
        .slice(0, 15)
    : [];
  const synonyms = Array.isArray(raw.synonyms) ? [...new Set(raw.synonyms.map((x) => str(x, 200)).filter(Boolean))].slice(0, 20) : [];
  const seasonYear = int(raw.seasonYear, 1900, 2100, 'Year');
  return {
    core: {
      canonicalTitle,
      synopsis: str(raw.synopsis, 10000),
      background: str(raw.background, 10000) || null,
      type: oneOf(raw.type, ANIME_TYPES, 'Format') || 'TV',
      status: oneOf(raw.status, ANIME_STATUSES, 'Status') || 'Not Yet Aired',
      source: oneOf(raw.source, ANIME_SOURCES, 'Source') || null,
      episodes: int(raw.episodes, 1, 5000, 'Episodes'),
      duration: str(raw.duration, 40) || null,
      rating: oneOf(raw.rating, AGE_RATINGS, 'Age rating') || null,
      season: oneOf(raw.season, ANIME_SEASONS, 'Season') || null,
      seasonYear,
      year: seasonYear ?? (startDate ? startDate.getUTCFullYear() : null),
      startDate,
      airedFrom: startDate,
      startYear: startDate ? startDate.getUTCFullYear() : null,
      endDate,
      airedTo: endDate,
      broadcastDay: oneOf(raw.broadcastDay, WEEKDAYS, 'Broadcast day') || null,
      broadcastTime: time || null,
      country: str(raw.country, 2).toUpperCase() || 'JP',
      posterUrl: poster ?? '',
      largePosterUrl: poster || null,
      bannerUrl: banner ?? null,
      trailerUrl: trailer ?? null,
      anilistId: int(raw.anilistId, 1, 10_000_000, 'AniList ID'),
      malId: int(raw.malId, 1, 10_000_000, 'MyAnimeList ID'),
    },
    titles: { english: str(raw.englishTitle, 300), romaji: str(raw.romajiTitle, 300), japanese: str(raw.nativeTitle, 300), synonyms },
    genreIds: ids(raw.genreIds),
    themeIds: ids(raw.themeIds),
    studios,
    streaming,
  };
}

async function uniqueSlug(title: string, year: number | null) {
  const base = generateSlug(title) || 'anime';
  for (const candidate of [base, year ? `${base}-${year}` : null, `${base}-${Date.now().toString(36)}`]) {
    if (candidate && !(await prisma.anime.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Fields compared/overridden on an existing anime (provider-synced columns). */
const TRACKED = [
  'canonicalTitle', 'synopsis', 'background', 'type', 'status', 'source', 'episodes', 'duration', 'rating', 'season', 'seasonYear',
  'startDate', 'endDate', 'broadcastDay', 'broadcastTime', 'country', 'posterUrl', 'bannerUrl', 'trailerUrl', 'anilistId', 'malId',
] as const;

const asText = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? null : String(v));

/** Create (id null) or update an anime from the form. Returns its id/slug and what changed. */
export async function saveAnimeForm(id: string | null, raw: Partial<Record<keyof AnimeFormValues, unknown>>, actorId: string) {
  const v = validate(raw);

  // Ids must not collide with another anime (one row per provider id).
  for (const [field, value] of [['anilistId', v.core.anilistId], ['malId', v.core.malId]] as const) {
    if (value === null) continue;
    const other = await prisma.anime.findFirst({ where: { [field]: value, ...(id ? { NOT: { id } } : {}) }, select: { slug: true } });
    if (other) throw new ControlEditError(409, `Another anime already has that ${field === 'anilistId' ? 'AniList' : 'MyAnimeList'} ID (/anime/${other.slug}).`);
  }
  if (v.genreIds.length) {
    const n = await prisma.genre.count({ where: { id: { in: v.genreIds } } });
    if (n !== v.genreIds.length) throw new ControlEditError(400, 'Unknown genre.');
  }
  if (v.themeIds.length) {
    const n = await prisma.theme.count({ where: { id: { in: v.themeIds } } });
    if (n !== v.themeIds.length) throw new ControlEditError(400, 'Unknown theme.');
  }
  if (v.studios.length) {
    const n = await prisma.studio.count({ where: { id: { in: v.studios.map((s) => s.id) } } });
    if (n !== v.studios.length) throw new ControlEditError(400, 'Unknown studio.');
  }

  const existing = id ? await prisma.anime.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new ControlEditError(404, 'Anime not found.');

  const changed: string[] = [];
  let animeId: string;
  let slug: string;

  await prisma.$transaction(async (tx) => {
    if (!existing) {
      slug = await uniqueSlug(v.core.canonicalTitle, v.core.year);
      const created = await tx.anime.create({
        data: { ...v.core, slug, externalSource: 'manual', isAdult: false, lastSyncedAt: new Date() },
        select: { id: true },
      });
      animeId = created.id;
      changed.push('created');
    } else {
      animeId = existing.id;
      slug = existing.slug;
      const data: Record<string, unknown> = {};
      for (const f of TRACKED) {
        const before = asText((existing as Record<string, unknown>)[f]);
        const after = asText((v.core as Record<string, unknown>)[f]);
        if ((before ?? '') !== (after ?? '')) {
          data[f] = (v.core as Record<string, unknown>)[f];
          changed.push(f);
          await tx.animeMetadataHistory.create({ data: { animeId, field: f, oldValue: before, newValue: after, source: 'control-center' } });
          if (after === null || after === '') await tx.editorialOverride.deleteMany({ where: { entityType: 'ANIME', entityId: animeId, field: f } });
          else
            await tx.editorialOverride.upsert({
              where: { entityType_entityId_field: { entityType: 'ANIME', entityId: animeId, field: f } },
              create: { entityType: 'ANIME', entityId: animeId, field: f, value: after.slice(0, 5000), createdBy: actorId, approvedAt: new Date(), reason: 'Set in the control center' },
              update: { value: after.slice(0, 5000), createdBy: actorId, approvedAt: new Date() },
            });
        }
      }
      // Dates/year follow the edited fields.
      if ('startDate' in data) Object.assign(data, { airedFrom: v.core.startDate, startYear: v.core.startYear });
      if ('endDate' in data) data.airedTo = v.core.endDate;
      if ('seasonYear' in data || 'startDate' in data) data.year = v.core.year;
      if ('posterUrl' in data) data.largePosterUrl = v.core.largePosterUrl;
      if (Object.keys(data).length) await tx.anime.update({ where: { id: animeId }, data });
    }

    // Titles by language: replace only the kinds this form manages.
    const titleRows: { type: string; title: string; language: string | null; isPrimary: boolean }[] = [
      { type: 'official', title: v.core.canonicalTitle, language: null, isPrimary: true },
      ...(v.titles.english ? [{ type: 'english', title: v.titles.english, language: 'en', isPrimary: false }] : []),
      ...(v.titles.romaji ? [{ type: 'romaji', title: v.titles.romaji, language: 'ja-Latn', isPrimary: false }] : []),
      ...(v.titles.japanese ? [{ type: 'japanese', title: v.titles.japanese, language: 'ja', isPrimary: false }] : []),
      ...v.titles.synonyms.map((t) => ({ type: 'synonym', title: t, language: null, isPrimary: false })),
    ];
    const current = await tx.animeTitle.findMany({ where: { animeId }, select: { type: true, title: true } });
    const key = (t: { type: string; title: string }) => `${t.type}\u0000${t.title}`;
    const want = new Set(titleRows.map(key));
    const have = new Set(current.map(key));
    if (current.some((t) => ['official', 'english', 'romaji', 'japanese', 'synonym'].includes(t.type) && !want.has(key(t))) || titleRows.some((t) => !have.has(key(t)))) {
      await tx.animeTitle.deleteMany({ where: { animeId, type: { in: ['official', 'english', 'romaji', 'japanese', 'synonym'] } } });
      await tx.animeTitle.createMany({
        data: titleRows.map((t) => ({ animeId, ...t, searchableTitle: t.title.toLowerCase() })),
      });
      if (existing) changed.push('titles');
    }

    // Genres / themes / studios: what the form shows is what's stored.
    const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    const g = (await tx.animeGenre.findMany({ where: { animeId }, select: { genreId: true } })).map((x) => x.genreId);
    if (!sameSet(g, v.genreIds)) {
      await tx.animeGenre.deleteMany({ where: { animeId } });
      if (v.genreIds.length) await tx.animeGenre.createMany({ data: v.genreIds.map((genreId) => ({ animeId, genreId })) });
      if (existing) changed.push('genres');
    }
    const t = (await tx.animeTheme.findMany({ where: { animeId }, select: { themeId: true } })).map((x) => x.themeId);
    if (!sameSet(t, v.themeIds)) {
      await tx.animeTheme.deleteMany({ where: { animeId } });
      if (v.themeIds.length) await tx.animeTheme.createMany({ data: v.themeIds.map((themeId) => ({ animeId, themeId })) });
      if (existing) changed.push('themes');
    }
    const s = await tx.animeStudio.findMany({ where: { animeId }, select: { studioId: true, isMain: true } });
    const sKey = (x: { id?: string; studioId?: string; isMain: boolean }) => `${x.id ?? x.studioId}:${x.isMain}`;
    if (!sameSet(s.map(sKey), v.studios.map(sKey))) {
      await tx.animeStudio.deleteMany({ where: { animeId } });
      if (v.studios.length)
        await tx.animeStudio.createMany({
          data: v.studios.map((st, i) => ({
            animeId,
            studioId: st.id,
            isMain: st.isMain,
            isPrimary: st.isMain && i === v.studios.findIndex((x) => x.isMain),
            role: st.isMain ? 'MAIN_STUDIO' : 'ANIMATION',
            source: 'ADMIN_OVERRIDE',
          })),
        });
      if (existing) changed.push('studios');
    }

    // Where to watch: the editor's own rows only (provider rows are kept).
    const mine = await tx.streamingAvailability.findMany({ where: { animeId, source: 'EDITORIAL' }, select: { provider: true, url: true } });
    const wantS = v.streaming.map((x) => `${x.provider}|${x.url}`);
    if (!sameSet(mine.map((x) => `${x.provider}|${x.url}`), wantS)) {
      await tx.streamingAvailability.deleteMany({ where: { animeId, source: 'EDITORIAL' } });
      if (v.streaming.length) await tx.streamingAvailability.createMany({ data: v.streaming.map((x) => ({ animeId, provider: x.provider, url: x.url, source: 'EDITORIAL' })) });
      if (existing) changed.push('streaming');
    }
  });

  CacheManager.invalidateTag(`tag:anime:${animeId!}`);
  CacheManager.invalidateTag(`tag:anime:${slug!}`);
  return { id: animeId!, slug: slug!, created: !existing, changed };
}

export async function searchStudios(q: string) {
  const term = q.trim().slice(0, 60);
  if (!term) return [];
  return prisma.studio.findMany({
    where: { status: { not: 'MERGED' }, name: { contains: term, mode: 'insensitive' } },
    orderBy: { animeStudios: { _count: 'desc' } },
    take: 12,
    select: { id: true, name: true },
  });
}
