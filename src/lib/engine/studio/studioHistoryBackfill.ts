/**
 * OTAKUVA STUDIO HISTORY BACKFILL SERVICE (PHASE 9.2)
 * 
 * Non-Destructive Controlled Data Migration:
 * - Seeds structured StudioEras from canonical history eras
 * - Seeds structured StudioHistoryEvents from canonical timeline milestones
 * - Resolves & links related Anime entities automatically
 * - Idempotent execution (safe to run repeatedly)
 */

import { prisma } from '../../prisma';
import { CANONICAL_STUDIOS, StudioMilestone } from '../../studioKnowledge';
import { StudioEventType, StudioEventImportance } from './studioHistoryTypes';

export interface HistoryBackfillSummary {
  studiosProcessed: number;
  erasCreated: number;
  eventsCreated: number;
  animeLinked: number;
  durationMs: number;
}

export async function runStudioHistoryBackfill(): Promise<HistoryBackfillSummary> {
  const startTime = Date.now();
  const summary: HistoryBackfillSummary = {
    studiosProcessed: 0,
    erasCreated: 0,
    eventsCreated: 0,
    animeLinked: 0,
    durationMs: 0,
  };

  for (const key of Object.keys(CANONICAL_STUDIOS)) {
    const knowledge = CANONICAL_STUDIOS[key];

    const studio = await prisma.studio.findFirst({
      where: {
        OR: [
          { slug: knowledge.slug },
          { name: knowledge.name },
          { slug: key },
        ],
      },
    });

    if (!studio) continue;
    summary.studiosProcessed++;

    // 1. Create Default Eras if missing
    let era1 = await prisma.studioEra.findFirst({ where: { studioId: studio.id, name: 'Founding & Early Era' } });
    if (!era1) {
      era1 = await prisma.studioEra.create({
        data: {
          studioId: studio.id,
          name: 'Founding & Early Era',
          description: knowledge.history?.foundingEra || 'Founding and early groundbreaking productions.',
          startYear: knowledge.foundedYear,
          endYear: knowledge.foundedYear + 15,
          displayOrder: 1,
        },
      });
      summary.erasCreated++;
    }

    let era2 = await prisma.studioEra.findFirst({ where: { studioId: studio.id, name: 'Golden Age & Breakthroughs' } });
    if (!era2) {
      era2 = await prisma.studioEra.create({
        data: {
          studioId: studio.id,
          name: 'Golden Age & Breakthroughs',
          description: knowledge.history?.goldenAge || 'Acclaimed masterpiece productions and international recognition.',
          startYear: knowledge.foundedYear + 16,
          endYear: knowledge.foundedYear + 35,
          displayOrder: 2,
        },
      });
      summary.erasCreated++;
    }

    let era3 = await prisma.studioEra.findFirst({ where: { studioId: studio.id, name: 'Modern Era' } });
    if (!era3) {
      era3 = await prisma.studioEra.create({
        data: {
          studioId: studio.id,
          name: 'Modern Era',
          description: knowledge.history?.modernEra || 'Contemporary industry-leading television and cinematic works.',
          startYear: knowledge.foundedYear + 36,
          endYear: new Date().getFullYear(),
          displayOrder: 3,
        },
      });
      summary.erasCreated++;
    }

    // 2. Ingest Timeline Milestones
    if (knowledge.timeline && knowledge.timeline.length > 0) {
      let orderCounter = 1;
      for (const m of knowledge.timeline) {
        const existingEvent = await prisma.studioHistoryEvent.findFirst({
          where: {
            studioId: studio.id,
            title: m.title,
            eventYear: m.year,
          },
        });

        if (!existingEvent) {
          // Map category to StudioEventType and StudioEventImportance
          let eventType: StudioEventType = 'MILESTONE';
          let importance: StudioEventImportance = 'IMPORTANT';

          if (m.category === 'FOUNDING') {
            eventType = 'FOUNDING';
            importance = 'CRITICAL';
          } else if (m.category === 'BREAKTHROUGH') {
            eventType = 'MAJOR_PROJECT';
            importance = 'MAJOR';
          } else if (m.category === 'EXPANSION') {
            eventType = 'EXPANSION';
            importance = 'IMPORTANT';
          } else if (m.category === 'CURRENT') {
            eventType = 'PRODUCTION_EVENT';
            importance = 'MAJOR';
          }

          // Link to corresponding era based on year
          let assignedEraId: string | null = null;
          if (m.year <= (era1.endYear || knowledge.foundedYear + 15)) {
            assignedEraId = era1.id;
          } else if (m.year <= (era2.endYear || knowledge.foundedYear + 35)) {
            assignedEraId = era2.id;
          } else {
            assignedEraId = era3.id;
          }

          // Resolve Related Anime if specified
          let relatedAnimeId: string | null = null;
          if (m.relatedAnime) {
            const animeMatch = await prisma.anime.findFirst({
              where: {
                OR: [
                  { canonicalTitle: { contains: m.relatedAnime } },
                  { slug: { contains: m.relatedAnime.toLowerCase().replace(/[^a-z0-9]+/g, '-') } },
                ],
              },
            });
            if (animeMatch) {
              relatedAnimeId = animeMatch.id;
              summary.animeLinked++;
            }
          }

          await prisma.studioHistoryEvent.create({
            data: {
              studioId: studio.id,
              eraId: assignedEraId,
              title: m.title,
              shortDescription: m.description,
              fullDescription: `${m.description} Documented in the canonical OTAKUVA Animation History Archive.`,
              eventYear: m.year,
              eventType,
              importance,
              displayOrder: orderCounter++,
              animeId: relatedAnimeId,
              source: 'OTAKUVA Animation Knowledge Base',
              sourceType: 'ARCHIVE',
              verificationStatus: 'VERIFIED',
              publicationState: 'PUBLISHED',
            },
          });

          summary.eventsCreated++;
        }
      }
    }
  }

  summary.durationMs = Date.now() - startTime;
  return summary;
}
