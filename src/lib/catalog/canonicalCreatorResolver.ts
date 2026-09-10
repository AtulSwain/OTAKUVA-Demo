/**
 * OTAKUVA ANIME CATALOG & DATA INGESTION ENGINE — PHASE 13
 * CANONICAL CREATOR / PERSON RESOLVER (13.24 & 13.25)
 * 
 * Maps multi-source staff and voice actors to canonical Person entities:
 * - Prevents duplicate person entries with different romanizations/kanji
 * - Links external IDs
 */

import { prisma } from '../prisma';
import { generateSlug, sanitizePublicEntityName } from '../normalizers';

export class CanonicalCreatorResolver {
  /**
   * Resolves raw creator information into a canonical Person entity
   */
  static async resolvePerson(person: {
    externalId?: string | null;
    name: string;
    nameKanji?: string | null;
    imageUrl?: string | null;
  }): Promise<{ personId: string; personName: string; isNew: boolean }> {
    const sanitizedName = sanitizePublicEntityName(person.name) || person.name.trim();
    const trimmedName = sanitizedName.trim();
    const slug = generateSlug(trimmedName, person.externalId || undefined);

    // 1. Check by External ID if present
    if (person.externalId) {
      const matchById = await prisma.person.findFirst({
        where: { externalId: person.externalId },
        select: { id: true, name: true },
      });
      if (matchById) {
        return { personId: matchById.id, personName: matchById.name, isNew: false };
      }
    }

    // 2. Check by exact name or slug
    const matchByName = await prisma.person.findFirst({
      where: {
        OR: [{ name: trimmedName }, { slug }],
      },
      select: { id: true, name: true, externalId: true },
    });

    if (matchByName) {
      if (person.externalId && !matchByName.externalId) {
        await prisma.person.update({
          where: { id: matchByName.id },
          data: { externalId: person.externalId },
        }).catch(() => {});
      }
      return { personId: matchByName.id, personName: matchByName.name, isNew: false };
    }

    // 3. Create canonical Person record
    const created = await prisma.person.create({
      data: {
        externalId: person.externalId || null,
        name: trimmedName,
        slug,
        nameKanji: person.nameKanji || null,
        imageUrl: person.imageUrl || null,
      },
      select: { id: true, name: true },
    });

    return { personId: created.id, personName: created.name, isNew: true };
  }
}
