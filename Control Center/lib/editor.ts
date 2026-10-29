/**
 * Control center edits (2026-10-28). Manual values are the editorial layer
 * (CLAUDE.md rule 1): every change is written to the row AND recorded as an
 * EditorialOverride, so provider sync never replaces it (syncEngine skips
 * overridden fields). Clearing a value removes the override, handing the
 * field back to sync. Anime changes are logged to AnimeMetadataHistory.
 */
import { prisma } from '@/lib/prisma';
import { CacheManager } from '@/lib/performance/cacheManager';
import { cleanImageUrl, cleanTrailerUrl } from './access';
import { sanitizePublicEntityName } from '@/lib/normalizers';

export class ControlEditError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const SOURCE = 'control-center';

async function setOverride(entityType: string, entityId: string, field: string, value: string | null, actorId: string) {
  if (value === null) {
    await prisma.editorialOverride.deleteMany({ where: { entityType, entityId, field } });
    return;
  }
  await prisma.editorialOverride.upsert({
    where: { entityType_entityId_field: { entityType, entityId, field } },
    create: { entityType, entityId, field, value, createdBy: actorId, approvedAt: new Date(), reason: 'Set in the control center' },
    update: { value, createdBy: actorId, approvedAt: new Date() },
  });
}

export interface AnimeEdits {
  canonicalTitle?: unknown;
  synopsis?: unknown;
  posterUrl?: unknown;
  bannerUrl?: unknown;
  trailerUrl?: unknown;
}

export async function editAnime(animeId: string, raw: AnimeEdits, actorId: string) {
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    select: { id: true, slug: true, canonicalTitle: true, synopsis: true, posterUrl: true, bannerUrl: true, trailerUrl: true },
  });
  if (!anime) throw new ControlEditError(404, 'Anime not found.');

  const next: Record<string, string | null> = {};
  if (raw.canonicalTitle !== undefined) {
    const t = typeof raw.canonicalTitle === 'string' ? raw.canonicalTitle.replace(/\s+/g, ' ').trim() : '';
    if (t.length < 1 || t.length > 300) throw new ControlEditError(400, 'Title must be 1–300 characters.');
    next.canonicalTitle = t;
  }
  if (raw.synopsis !== undefined) {
    const s = typeof raw.synopsis === 'string' ? raw.synopsis.replace(/\r\n/g, '\n').trim() : '';
    if (s.length > 10000) throw new ControlEditError(400, 'Synopsis must be at most 10,000 characters.');
    next.synopsis = s || null;
  }
  for (const f of ['posterUrl', 'bannerUrl'] as const) {
    if (raw[f] === undefined) continue;
    const v = cleanImageUrl(raw[f]);
    if (v === undefined) throw new ControlEditError(400, `${f === 'posterUrl' ? 'Poster' : 'Banner'} must be an https:// image link or an uploaded file.`);
    next[f] = v;
  }
  if (raw.trailerUrl !== undefined) {
    const v = cleanTrailerUrl(raw.trailerUrl);
    if (v === undefined) throw new ControlEditError(400, 'Trailer must be a YouTube link.');
    next.trailerUrl = v;
  }

  const changed = Object.entries(next).filter(([k, v]) => (anime as Record<string, unknown>)[k] !== v);
  if (changed.length === 0) return { changed: [] as string[] };

  const data: Record<string, string | null> = Object.fromEntries(changed);
  // The poster drives both stored sizes.
  if ('posterUrl' in data) data.largePosterUrl = data.posterUrl;
  // posterUrl and synopsis are required columns: "cleared" is an empty string.
  if (data.posterUrl === null) data.posterUrl = '';
  if (data.synopsis === null) data.synopsis = '';

  await prisma.$transaction(async (tx) => {
    await tx.anime.update({ where: { id: animeId }, data });
    for (const [field, value] of changed) {
      await tx.animeMetadataHistory.create({
        data: { animeId, field, oldValue: ((anime as Record<string, unknown>)[field] as string | null) ?? null, newValue: value, source: SOURCE },
      });
    }
  });
  for (const [field, value] of changed) await setOverride('ANIME', animeId, field, value, actorId);

  CacheManager.invalidateTag(`tag:anime:${animeId}`);
  if (anime.slug) CacheManager.invalidateTag(`tag:anime:${anime.slug}`);
  return { changed: changed.map(([k]) => k) };
}

export async function setPersonPhoto(personId: string, rawUrl: unknown, actorId: string) {
  const url = cleanImageUrl(rawUrl);
  if (url === undefined) throw new ControlEditError(400, 'Photo must be an https:// image link or an uploaded file.');
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!person) throw new ControlEditError(404, 'Person not found.');
  await prisma.person.update({ where: { id: personId }, data: { imageUrl: url } });
  await setOverride('PERSON', personId, 'imageUrl', url, actorId);
  return { imageUrl: url };
}

export async function setCharacterImage(characterId: string, rawUrl: unknown, actorId: string) {
  const url = cleanImageUrl(rawUrl);
  if (url === undefined) throw new ControlEditError(400, 'Image must be an https:// image link or an uploaded file.');
  const ch = await prisma.character.findUnique({ where: { id: characterId }, select: { id: true } });
  if (!ch) throw new ControlEditError(404, 'Character not found.');
  await prisma.character.update({ where: { id: characterId }, data: { imageUrl: url } });
  await setOverride('CHARACTER', characterId, 'imageUrl', url, actorId);
  return { imageUrl: url };
}

/** Studios already have admin-override columns; the logo goes there. */
export async function setStudioLogo(studioId: string, rawUrl: unknown, actorId: string) {
  const url = cleanImageUrl(rawUrl);
  if (url === undefined) throw new ControlEditError(400, 'Logo must be an https:// image link or an uploaded file.');
  const studio = await prisma.studio.findUnique({ where: { id: studioId }, select: { id: true } });
  if (!studio) throw new ControlEditError(404, 'Studio not found.');
  await prisma.studio.update({ where: { id: studioId }, data: { adminOverrideImageUrl: url, hasAdminOverride: true } });
  await setOverride('STUDIO', studioId, 'imageUrl', url, actorId);
  return { logoUrl: url };
}

/** Display name for lists (strips provider junk the same way public pages do). */
export const cleanName = (s: string | null | undefined) => (s ? sanitizePublicEntityName(s) || s : '');
