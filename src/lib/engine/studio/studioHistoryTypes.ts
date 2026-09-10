/**
 * OTAKUVA STUDIO HISTORY & INTERACTIVE TIMELINE TYPES (PHASE 9.2)
 */

export type StudioEventType =
  | 'FOUNDING'
  | 'NAME_CHANGE'
  | 'LEADERSHIP'
  | 'MAJOR_PROJECT'
  | 'COMPANY_CHANGE'
  | 'ACQUISITION'
  | 'MERGER'
  | 'EXPANSION'
  | 'OFFICE_CHANGE'
  | 'AWARD'
  | 'MILESTONE'
  | 'STAFF_CHANGE'
  | 'PRODUCTION_EVENT'
  | 'OTHER';

export type StudioEventImportance =
  | 'LOW'
  | 'NORMAL'
  | 'IMPORTANT'
  | 'MAJOR'
  | 'CRITICAL';

export type StudioSourceType =
  | 'OFFICIAL'
  | 'DATABASE'
  | 'ARCHIVE'
  | 'INTERVIEW'
  | 'NEWS'
  | 'BOOK'
  | 'PUBLICATION'
  | 'OTHER';

export interface CreateHistoryEventInput {
  studioId: string;
  eraId?: string | null;
  title: string;
  shortDescription?: string | null;
  fullDescription?: string | null;
  eventDate?: Date | string | null;
  eventYear?: number | null;
  eventEndDate?: Date | string | null;
  eventEndYear?: number | null;
  eventType?: StudioEventType;
  importance?: StudioEventImportance;
  displayOrder?: number;
  imageUrl?: string | null;
  imageCaption?: string | null;
  imageAltText?: string | null;
  personId?: string | null;
  animeId?: string | null;
  relatedStudioId?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  sourceType?: StudioSourceType;
  verificationStatus?: 'UNVERIFIED' | 'NEEDS_REVIEW' | 'PARTIALLY_VERIFIED' | 'VERIFIED';
  publicationState?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';
}

export interface UpdateHistoryEventInput extends Partial<CreateHistoryEventInput> {
  reason?: string;
}

export interface CreateEraInput {
  studioId: string;
  name: string;
  description?: string | null;
  startDate?: Date | string | null;
  startYear?: number | null;
  endDate?: Date | string | null;
  endYear?: number | null;
  displayOrder?: number;
}

export interface UpdateEraInput extends Partial<CreateEraInput> {
  reason?: string;
}

export interface HistoryEventFilterOptions {
  q?: string;
  search?: string;
  year?: number;
  yearMin?: number;
  yearMax?: number;
  eventType?: StudioEventType | 'ALL';
  importance?: StudioEventImportance | 'ALL';
  majorOnly?: boolean;
  eraId?: string;
  verificationStatus?: string | 'ALL';
  publicationState?: string | 'ALL';
  sortBy?: 'chronological' | 'reverseChronological' | 'importance' | 'createdAt';
  page?: number;
  limit?: number;
}

export interface StudioHistoryEventItem {
  id: string;
  studioId: string;
  eraId?: string | null;
  eraName?: string | null;
  title: string;
  shortDescription?: string | null;
  fullDescription?: string | null;
  eventDate?: Date | null;
  eventYear?: number | null;
  eventEndDate?: Date | null;
  eventEndYear?: number | null;
  displayDate: string; // e.g. "1972", "October 17, 1972", "1989 → 1992"
  eventType: StudioEventType;
  importance: StudioEventImportance;
  displayOrder: number;
  imageUrl?: string | null;
  imageCaption?: string | null;
  imageAltText?: string | null;
  person?: {
    id: string;
    name: string;
    slug?: string | null;
    imageUrl?: string | null;
  } | null;
  anime?: {
    id: string;
    canonicalTitle: string;
    slug: string;
    posterUrl: string;
    score?: number | null;
    year?: number | null;
    type: string;
  } | null;
  relatedStudio?: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
  } | null;
  source?: string | null;
  sourceUrl?: string | null;
  sourceType: StudioSourceType;
  verificationStatus: string;
  publicationState: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudioEraItem {
  id: string;
  studioId: string;
  name: string;
  description?: string | null;
  startDate?: Date | null;
  startYear?: number | null;
  endDate?: Date | null;
  endYear?: number | null;
  displayPeriod: string; // e.g. "1972–1988"
  displayOrder: number;
  eventCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DuplicateHistoryMatch {
  event: {
    id: string;
    title: string;
    eventYear?: number | null;
    eventType: string;
    importance: string;
  };
  confidenceScore: number;
  reason: string;
}
