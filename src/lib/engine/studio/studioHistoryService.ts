/**
 * OTAKUVA STUDIO HISTORY SERVICE (PHASE 9.2)
 * 
 * Public Data Layer for Studio History & Interactive Timelines:
 * - Chronological sequence aggregation & date-range representation
 * - Multi-criteria filtering (by year, era, importance, milestone category)
 * - Selective joins for related Anime, Founders, and Studio Eras
 * - Strict publication state isolation (drafts excluded from anonymous public queries)
 */

import { prisma } from '../../prisma';
import {
  HistoryEventFilterOptions,
  StudioEraItem,
  StudioHistoryEventItem,
} from './studioHistoryTypes';

export class StudioHistoryService {
  /**
   * Formats a human-readable display date string from exact dates, years, or date ranges
   */
  formatDisplayDate(
    eventDate?: Date | null,
    eventYear?: number | null,
    eventEndDate?: Date | null,
    eventEndYear?: number | null
  ): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let startStr = '';
    if (eventDate) {
      const d = new Date(eventDate);
      startStr = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    } else if (eventYear) {
      startStr = String(eventYear);
    } else {
      startStr = 'Historical Date Unknown';
    }

    if (eventEndDate || eventEndYear) {
      let endStr = '';
      if (eventEndDate) {
        const d = new Date(eventEndDate);
        endStr = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
      } else if (eventEndYear) {
        endStr = String(eventEndYear);
      }
      return `${startStr} → ${endStr}`;
    }

    return startStr;
  }

  /**
   * Formats raw StudioHistoryEvent DB record into DTO
   */
  formatHistoryEvent(raw: any): StudioHistoryEventItem {
    const displayDate = this.formatDisplayDate(
      raw.eventDate,
      raw.eventYear,
      raw.eventEndDate,
      raw.eventEndYear
    );

    return {
      id: raw.id,
      studioId: raw.studioId,
      eraId: raw.eraId,
      eraName: raw.era?.name || null,
      title: raw.title,
      shortDescription: raw.shortDescription,
      fullDescription: raw.fullDescription,
      eventDate: raw.eventDate,
      eventYear: raw.eventYear,
      eventEndDate: raw.eventEndDate,
      eventEndYear: raw.eventEndYear,
      displayDate,
      eventType: raw.eventType,
      importance: raw.importance,
      displayOrder: raw.displayOrder,
      imageUrl: raw.imageUrl,
      imageCaption: raw.imageCaption,
      imageAltText: raw.imageAltText,
      person: raw.person
        ? {
            id: raw.person.id,
            name: raw.person.name,
            slug: raw.person.slug,
            imageUrl: raw.person.imageUrl,
          }
        : null,
      anime: raw.anime
        ? {
            id: raw.anime.id,
            canonicalTitle: raw.anime.canonicalTitle,
            slug: raw.anime.slug,
            posterUrl: raw.anime.posterUrl,
            score: raw.anime.score,
            year: raw.anime.year,
            type: raw.anime.type,
          }
        : null,
      relatedStudio: raw.relatedStudio
        ? {
            id: raw.relatedStudio.id,
            name: raw.relatedStudio.name,
            slug: raw.relatedStudio.slug,
            imageUrl: raw.relatedStudio.imageUrl,
          }
        : null,
      source: raw.source,
      sourceUrl: raw.sourceUrl,
      sourceType: raw.sourceType || 'OFFICIAL',
      verificationStatus: raw.verificationStatus || 'UNVERIFIED',
      publicationState: raw.publicationState || 'PUBLISHED',
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  /**
   * Retrieves public chronological history events for a studio
   */
  async getStudioHistory(studioSlugOrId: string, options: HistoryEventFilterOptions = {}) {
    const {
      year,
      yearMin,
      yearMax,
      eventType,
      importance,
      majorOnly,
      eraId,
      sortBy = 'chronological',
      page = 1,
      limit = 50,
    } = options;

    const studio = await prisma.studio.findFirst({
      where: {
        OR: [
          { slug: studioSlugOrId },
          { id: studioSlugOrId },
          { name: studioSlugOrId },
        ],
        publicationState: 'PUBLISHED',
      },
      select: { id: true, name: true, slug: true, about: true },
    });

    if (!studio) {
      return { studio: null, events: [], total: 0, eras: [], page, limit, totalPages: 0 };
    }

    const where: any = {
      studioId: studio.id,
      publicationState: 'PUBLISHED', // Public queries never expose drafts
    };

    if (year) {
      where.eventYear = year;
    } else if (yearMin || yearMax) {
      where.eventYear = {};
      if (yearMin) where.eventYear.gte = yearMin;
      if (yearMax) where.eventYear.lte = yearMax;
    }

    if (eventType && eventType !== 'ALL') {
      where.eventType = eventType;
    }

    if (majorOnly) {
      where.importance = { in: ['IMPORTANT', 'MAJOR', 'CRITICAL'] };
    } else if (importance && importance !== 'ALL') {
      where.importance = importance;
    }

    if (eraId) {
      where.eraId = eraId;
    }

    let orderBy: any = [];
    if (sortBy === 'reverseChronological') {
      orderBy = [{ eventYear: 'desc' }, { eventDate: 'desc' }, { displayOrder: 'desc' }];
    } else if (sortBy === 'importance') {
      orderBy = [{ importance: 'desc' }, { eventYear: 'asc' }];
    } else {
      // Default: chronological
      orderBy = [{ eventYear: 'asc' }, { eventDate: 'asc' }, { displayOrder: 'asc' }];
    }

    const skip = (Math.max(1, page) - 1) * limit;

    const [events, total, eras] = await Promise.all([
      prisma.studioHistoryEvent.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          era: true,
          person: true,
          anime: true,
          relatedStudio: true,
        },
      }),
      prisma.studioHistoryEvent.count({ where }),
      prisma.studioEra.findMany({
        where: { studioId: studio.id },
        orderBy: { displayOrder: 'asc' },
        include: {
          _count: {
            select: {
              events: { where: { publicationState: 'PUBLISHED' } },
            },
          },
        },
      }),
    ]);

    const formattedEvents = events.map((e) => this.formatHistoryEvent(e));
    const formattedEras: StudioEraItem[] = eras.map((era) => {
      const displayPeriod = era.startYear && era.endYear
        ? `${era.startYear}–${era.endYear}`
        : era.startYear
        ? `${era.startYear}–Present`
        : 'Era';

      return {
        id: era.id,
        studioId: era.studioId,
        name: era.name,
        description: era.description,
        startDate: era.startDate,
        startYear: era.startYear,
        endDate: era.endDate,
        endYear: era.endYear,
        displayPeriod,
        displayOrder: era.displayOrder,
        eventCount: era._count.events,
        createdAt: era.createdAt,
        updatedAt: era.updatedAt,
      };
    });

    return {
      studio,
      events: formattedEvents,
      eras: formattedEras,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single historical event by ID with full entity graph
   */
  async getHistoryEventById(eventId: string): Promise<StudioHistoryEventItem | null> {
    const event = await prisma.studioHistoryEvent.findUnique({
      where: { id: eventId },
      include: {
        era: true,
        person: true,
        anime: true,
        relatedStudio: true,
      },
    });

    if (!event) return null;
    return this.formatHistoryEvent(event);
  }

  /**
   * Retrieves all eras for a studio
   */
  async getStudioEras(studioId: string): Promise<StudioEraItem[]> {
    const eras = await prisma.studioEra.findMany({
      where: { studioId },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: {
            events: { where: { publicationState: 'PUBLISHED' } },
          },
        },
      },
    });

    return eras.map((era) => ({
      id: era.id,
      studioId: era.studioId,
      name: era.name,
      description: era.description,
      startDate: era.startDate,
      startYear: era.startYear,
      endDate: era.endDate,
      endYear: era.endYear,
      displayPeriod: era.startYear && era.endYear ? `${era.startYear}–${era.endYear}` : `${era.startYear || ''}`,
      displayOrder: era.displayOrder,
      eventCount: era._count.events,
      createdAt: era.createdAt,
      updatedAt: era.updatedAt,
    }));
  }
}

export const studioHistoryService = new StudioHistoryService();
