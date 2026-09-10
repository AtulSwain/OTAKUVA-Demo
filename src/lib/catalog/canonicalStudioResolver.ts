/**
 * OTAKUVA ANIME CATALOG & DATA INGESTION ENGINE — PHASE 13
 * CANONICAL STUDIO ENTITY RESOLVER (13.21 → 13.23)
 * 
 * Maps messy provider studio names to canonical Studio entities:
 * - "MAPPA", "Mappa", "株式会社MAPPA", "MAPPA Co., Ltd." => Single Canonical MAPPA Studio
 * - Transparent alias and redirect resolution
 * - Automatic alias registration
 */

import { prisma } from '../prisma';
import { generateSlug, normalizeSearchTitle, sanitizePublicEntityName } from '../normalizers';

export class CanonicalStudioResolver {
  /**
   * Resolves a raw studio name to a canonical Studio ID
   */
  static async resolveStudio(rawStudioName: string): Promise<{ studioId: string; studioName: string; isNew: boolean }> {
    const sanitized = sanitizePublicEntityName(rawStudioName) || rawStudioName.trim();
    const trimmed = sanitized.trim();
    const normalized = normalizeSearchTitle(trimmed);
    const slug = generateSlug(trimmed);

    // 1. Direct name match
    const directMatch = await prisma.studio.findFirst({
      where: {
        OR: [{ name: trimmed }, { slug }],
      },
      select: { id: true, name: true },
    });

    if (directMatch) {
      return { studioId: directMatch.id, studioName: directMatch.name, isNew: false };
    }

    // 2. Check StudioAlias
    const aliasMatch = await prisma.studioAlias.findFirst({
      where: {
        OR: [{ alias: trimmed }, { normalizedAlias: normalized }],
      },
      include: { studio: { select: { id: true, name: true } } },
    });

    if (aliasMatch && aliasMatch.studio) {
      return { studioId: aliasMatch.studio.id, studioName: aliasMatch.studio.name, isNew: false };
    }

    // 3. Check StudioRedirect
    const redirectMatch = await prisma.studioRedirect.findFirst({
      where: { sourceIdentifier: slug },
      include: { canonicalStudio: { select: { id: true, name: true } } },
    });

    if (redirectMatch && redirectMatch.canonicalStudio) {
      return { studioId: redirectMatch.canonicalStudio.id, studioName: redirectMatch.canonicalStudio.name, isNew: false };
    }

    // 4. Strip legal prefixes and corporate suffixes (e.g. "Co., Ltd.", "Inc.", "株式会社")
    const cleanLegal = trimmed
      .replace(/^(?:株式会社|有限会社|合同会社)\s*/gi, '')
      .replace(/\s*(?:Co\.,?\s*Ltd\.?|Inc\.?|Corp\.?|Corporation|LLC|G\.K\.)(?:\s*)$/gi, '')
      .trim();

    if (cleanLegal.length > 2 && cleanLegal !== trimmed) {
      const parentMatch = await prisma.studio.findFirst({
        where: {
          OR: [{ name: cleanLegal }, { slug: generateSlug(cleanLegal) }],
        },
        select: { id: true, name: true },
      });

      if (parentMatch) {
        // Register raw trimmed as alias of parent
        await prisma.studioAlias.upsert({
          where: { studioId_normalizedAlias: { studioId: parentMatch.id, normalizedAlias: normalized } },
          update: {},
          create: {
            studioId: parentMatch.id,
            alias: trimmed,
            normalizedAlias: normalized,
            aliasType: 'IMPORT_NAME',
          },
        }).catch(() => {});

        return { studioId: parentMatch.id, studioName: parentMatch.name, isNew: false };
      }
    }

    // 5. Create new canonical Studio if non-existent
    const created = await prisma.studio.create({
      data: {
        name: trimmed,
        slug,
        status: 'ACTIVE',
        verificationStatus: 'PARTIALLY_VERIFIED',
      },
      select: { id: true, name: true },
    });

    return { studioId: created.id, studioName: created.name, isNew: true };
  }
}
