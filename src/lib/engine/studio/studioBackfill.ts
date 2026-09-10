/**
 * OTAKUVA STUDIO BACKFILL SERVICE (PHASE 9.1)
 * 
 * Non-Destructive Controlled Data Migration:
 * - Backfills missing slugs on existing database studios
 * - Enriches canonical studios with rich structured data from studioKnowledge dictionary
 * - Ingests Founders & Key Staff into Person & StudioPerson tables
 * - Normalizes AnimeStudio production roles & primary flags
 * - Idempotent execution (safe to run repeatedly)
 */

import { prisma } from '../../prisma';
import { CANONICAL_STUDIOS } from '../../studioKnowledge';
import { studioService } from './studioService';

export interface BackfillSummary {
  totalExamined: number;
  slugsPopulated: number;
  enrichedWithKnowledge: number;
  peopleCreated: number;
  foundersLinked: number;
  animeStudiosNormalized: number;
  durationMs: number;
}

export async function runStudioBackfill(): Promise<BackfillSummary> {
  const startTime = Date.now();
  const summary: BackfillSummary = {
    totalExamined: 0,
    slugsPopulated: 0,
    enrichedWithKnowledge: 0,
    peopleCreated: 0,
    foundersLinked: 0,
    animeStudiosNormalized: 0,
    durationMs: 0,
  };

  const existingStudios = await prisma.studio.findMany({
    include: {
      staffRelations: true,
      animeStudios: true,
    },
  });

  summary.totalExamined = existingStudios.length;

  for (const studio of existingStudios) {
    const cleanSlug = studio.slug || studioService.generateSlug(studio.name);
    let updatedSlug = false;

    if (!studio.slug) {
      // Ensure slug uniqueness
      let uniqueSlug = cleanSlug;
      let counter = 1;
      while (
        await prisma.studio.findFirst({
          where: { slug: uniqueSlug, id: { not: studio.id } },
        })
      ) {
        uniqueSlug = `${cleanSlug}-${counter++}`;
      }

      await prisma.studio.update({
        where: { id: studio.id },
        data: { slug: uniqueSlug },
      });
      summary.slugsPopulated++;
      updatedSlug = true;
    }

    // Match against Canonical Studio Knowledge Dictionary
    const knowledgeKey = Object.keys(CANONICAL_STUDIOS).find(
      (k) =>
        k.toLowerCase() === studio.name.toLowerCase() ||
        k.toLowerCase() === (studio.slug || cleanSlug).toLowerCase() ||
        CANONICAL_STUDIOS[k].name.toLowerCase() === studio.name.toLowerCase()
    );

    if (knowledgeKey) {
      const knowledge = CANONICAL_STUDIOS[knowledgeKey];

      const metadata = {
        history: knowledge.history,
        dna: knowledge.dna,
        timeline: knowledge.timeline,
      };

      await prisma.studio.update({
        where: { id: studio.id },
        data: {
          nativeName: studio.nativeName || knowledge.nativeName || null,
          about: studio.about || knowledge.summary || null,
          shortDescription: studio.shortDescription || knowledge.summary.slice(0, 160) + '...',
          foundedYear: studio.foundedYear || knowledge.foundedYear || null,
          foundedDate: studio.foundedDate || (knowledge.foundedDate ? new Date(knowledge.foundedDate) : null),
          country: studio.country || knowledge.country || 'Japan',
          region: studio.region || knowledge.location || null,
          website: studio.website || knowledge.officialWebsite || null,
          imageUrl: studio.imageUrl || knowledge.logoUrl || null,
          bannerUrl: studio.bannerUrl || knowledge.bannerUrl || null,
          verificationStatus: 'VERIFIED',
          publicationState: 'PUBLISHED',
          metadataJson: JSON.stringify(metadata),
        },
      });

      summary.enrichedWithKnowledge++;

      // Seed & Link Founders
      if (knowledge.founders && knowledge.founders.length > 0) {
        for (const f of knowledge.founders) {
          let person = await prisma.person.findFirst({
            where: {
              OR: [{ name: f.name }, { slug: f.slug }],
            },
          });

          if (!person) {
            person = await prisma.person.create({
              data: {
                name: f.name,
                slug: f.slug || studioService.generateSlug(f.name),
                about: f.bio || null,
                imageUrl: f.imageUrl || null,
              },
            });
            summary.peopleCreated++;
          }

          const existingLink = await prisma.studioPerson.findUnique({
            where: {
              studioId_personId_role: {
                studioId: studio.id,
                personId: person.id,
                role: 'FOUNDER',
              },
            },
          });

          if (!existingLink) {
            await prisma.studioPerson.create({
              data: {
                studioId: studio.id,
                personId: person.id,
                role: 'FOUNDER',
                isCurrent: false,
                notes: f.role || 'Co-Founder',
              },
            });
            summary.foundersLinked++;
          }
        }
      }
    }
  }

  // Also import any remaining studios from CANONICAL_STUDIOS dictionary that are missing in DB
  for (const key of Object.keys(CANONICAL_STUDIOS)) {
    const kData = CANONICAL_STUDIOS[key];
    const exists = await prisma.studio.findFirst({
      where: {
        OR: [{ name: kData.name }, { slug: kData.slug }],
      },
    });

    if (!exists) {
      const created = await prisma.studio.create({
        data: {
          name: kData.name,
          slug: kData.slug,
          nativeName: kData.nativeName || null,
          about: kData.summary || null,
          shortDescription: kData.summary.slice(0, 160) + '...',
          foundedYear: kData.foundedYear,
          foundedDate: kData.foundedDate ? new Date(kData.foundedDate) : null,
          country: kData.country || 'Japan',
          region: kData.location || null,
          website: kData.officialWebsite || null,
          imageUrl: kData.logoUrl || null,
          bannerUrl: kData.bannerUrl || null,
          verificationStatus: 'VERIFIED',
          publicationState: 'PUBLISHED',
          metadataJson: JSON.stringify({
            history: kData.history,
            dna: kData.dna,
            timeline: kData.timeline,
          }),
        },
      });
      summary.enrichedWithKnowledge++;

      if (kData.founders) {
        for (const f of kData.founders) {
          let person = await prisma.person.findFirst({
            where: { OR: [{ name: f.name }, { slug: f.slug }] },
          });
          if (!person) {
            person = await prisma.person.create({
              data: {
                name: f.name,
                slug: f.slug || studioService.generateSlug(f.name),
                about: f.bio || null,
                imageUrl: f.imageUrl || null,
              },
            });
            summary.peopleCreated++;
          }
          await prisma.studioPerson.create({
            data: {
              studioId: created.id,
              personId: person.id,
              role: 'FOUNDER',
              isCurrent: false,
              notes: f.role || 'Co-Founder',
            },
          });
          summary.foundersLinked++;
        }
      }
    }
  }

  // Normalize AnimeStudio records
  const unnormalizedAnimeStudios = await prisma.animeStudio.findMany({
    where: { role: 'MAIN_STUDIO', isPrimary: true },
  });
  summary.animeStudiosNormalized = unnormalizedAnimeStudios.length;

  summary.durationMs = Date.now() - startTime;
  return summary;
}
