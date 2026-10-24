import { prisma } from '../prisma';
import { generateSlug } from '../normalizers';
import type { ProviderStaff } from '../providers/animeProvider.interface';

type StaffProvider = 'anilist' | 'jikan';

const isPlaceholderImage = (url?: string | null) => !url || /\/default\.(jpg|png)$|questionmark/i.test(url);

/**
 * Find or create the Person for one provider staff entry.
 *
 * People used to be matched by a name-only slug, so two different people
 * who share a name became one record, and `externalId` was overwritten by
 * whichever provider synced last (an AniList staff id and a MAL person id
 * in the same column). Now:
 *   1. match on the provider's own id (Person.anilistId / Person.malId);
 *   2. else a name-slug match is accepted only when that person has no
 *      *different* id for this provider — then the id is attached;
 *   3. else it's a different person: new row, slug `name-<id>`.
 * Existing values are only filled where empty, never overwritten.
 */
export async function resolveStaffPerson(s: ProviderStaff, provider: StaffProvider): Promise<string | null> {
  const providerId = parseInt(s.personExternalId, 10);
  if (!Number.isFinite(providerId) || !s.personName?.trim()) return null;
  const idField = provider === 'anilist' ? 'anilistId' : 'malId';
  const image = isPlaceholderImage(s.personImage) ? null : s.personImage;

  const byId = await prisma.person.findUnique({ where: idField === 'anilistId' ? { anilistId: providerId } : { malId: providerId } });
  if (byId) {
    await fillEmpty(byId, { nameKanji: s.personKanji ?? null, imageUrl: image ?? null });
    return byId.id;
  }

  const slug = generateSlug(s.personName, s.personExternalId);
  const bySlug = await prisma.person.findUnique({ where: { slug } });
  if (bySlug && (bySlug[idField] === null || bySlug[idField] === providerId)) {
    await prisma.person.update({
      where: { id: bySlug.id },
      data: {
        [idField]: providerId,
        ...(bySlug.nameKanji ? {} : s.personKanji ? { nameKanji: s.personKanji } : {}),
        ...(bySlug.imageUrl ? {} : image ? { imageUrl: image } : {}),
      },
    });
    return bySlug.id;
  }

  const created = await prisma.person.create({
    data: {
      name: s.personName.trim(),
      slug: bySlug ? `${slug}-${providerId}` : slug,
      externalId: s.personExternalId,
      [idField]: providerId,
      nameKanji: s.personKanji || null,
      imageUrl: image,
    },
  });
  return created.id;
}

async function fillEmpty(
  person: { id: string; nameKanji: string | null; imageUrl: string | null },
  values: { nameKanji: string | null; imageUrl: string | null }
) {
  const data: Record<string, string> = {};
  if (!person.nameKanji && values.nameKanji) data.nameKanji = values.nameKanji;
  if (!person.imageUrl && values.imageUrl) data.imageUrl = values.imageUrl;
  if (Object.keys(data).length) await prisma.person.update({ where: { id: person.id }, data });
}

/**
 * Link a provider's staff list to an anime. Credits are add-only (an
 * existing person+role row is never duplicated or removed). With
 * `addCredits: false` it only resolves the people — used for anime that
 * already have credits from another provider, so the same job isn't listed
 * twice under slightly different role wording.
 */
export async function linkStaffToAnime(
  animeId: string,
  staff: ProviderStaff[],
  provider: StaffProvider,
  { addCredits = true }: { addCredits?: boolean } = {}
): Promise<{ people: number; creditsAdded: number }> {
  let people = 0;
  let creditsAdded = 0;
  for (const s of staff) {
    const personId = await resolveStaffPerson(s, provider);
    if (!personId) continue;
    people++;
    if (!addCredits) continue;
    const role = s.positions.join(', ') || 'Staff';
    const exists = await prisma.animeStaff.findFirst({ where: { animeId, personId, role }, select: { id: true } });
    if (!exists) {
      await prisma.animeStaff.create({ data: { animeId, personId, role } });
      creditsAdded++;
    }
  }
  return { people, creditsAdded };
}
