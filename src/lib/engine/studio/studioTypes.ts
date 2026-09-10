/**
 * OTAKUVA STUDIO CORE DATA & MANAGEMENT TYPES (PHASE 9.1)
 */

export type StudioStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'CLOSED'
  | 'MERGED'
  | 'ACQUIRED'
  | 'UNKNOWN';

export type StudioVerificationStatus =
  | 'UNVERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'VERIFIED'
  | 'NEEDS_REVIEW';

export type StudioPublicationState =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'HIDDEN'
  | 'ARCHIVED';

export type StudioRole =
  | 'MAIN_STUDIO'
  | 'CO_PRODUCER'
  | 'ANIMATION'
  | 'PRODUCTION_ASSISTANCE'
  | 'CG'
  | 'BACKGROUND'
  | 'OTHER';

export type StudioPersonRole =
  | 'FOUNDER'
  | 'CO_FOUNDER'
  | 'CEO'
  | 'DIRECTOR'
  | 'PRODUCER'
  | 'EXECUTIVE'
  | 'KEY_STAFF';

export type StudioRelationshipType =
  | 'SUBSIDIARY'
  | 'PARENT_COMPANY'
  | 'SISTER_STUDIO'
  | 'MERGED_INTO'
  | 'SUCCESSOR'
  | 'SPIN_OFF';

export type StudioAuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'IMAGE_UPDATE'
  | 'ANIME_LINK'
  | 'ANIME_UNLINK'
  | 'PERSON_LINK'
  | 'PERSON_UNLINK'
  | 'MERGE'
  | 'OVERRIDE_APPLY'
  | 'OVERRIDE_RESET'
  | 'VERIFICATION_CHANGE';

export interface StudioExternalReference {
  provider: 'MAL' | 'ANILIST' | 'WIKIPEDIA' | 'OFFICIAL' | 'ANN' | 'IMDB' | 'TWITTER' | 'YOUTUBE';
  externalId?: string;
  url: string;
  lastVerifiedAt?: Date | string;
}

export interface StudioDNA {
  signatureStyle?: string;
  primaryGenres?: string[];
  artisticPhilosophy?: string;
}

export interface CreateStudioInput {
  name: string;
  nativeName?: string | null;
  romanizedName?: string | null;
  alternativeNames?: string[];
  slug?: string | null;
  about?: string | null;
  shortDescription?: string | null;
  foundedDate?: Date | string | null;
  foundedYear?: number | null;
  dissolvedDate?: Date | string | null;
  status?: StudioStatus;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  website?: string | null;
  wikipediaUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  verificationStatus?: StudioVerificationStatus;
  publicationState?: StudioPublicationState;
  externalLinks?: StudioExternalReference[];
  metadata?: Record<string, any>;
  adminNotes?: string | null;
}

export interface UpdateStudioInput extends Partial<CreateStudioInput> {
  reason?: string;
}

export interface AdminOverrideStudioInput {
  name?: string | null;
  about?: string | null;
  foundedYear?: number | null;
  imageUrl?: string | null;
  website?: string | null;
  overrideReason?: string;
}

export interface StudioFilterOptions {
  q?: string;
  search?: string;
  status?: StudioStatus | 'ALL';
  country?: string;
  foundedYearMin?: number;
  foundedYearMax?: number;
  verificationStatus?: StudioVerificationStatus | 'ALL';
  publicationState?: StudioPublicationState | 'ALL';
  hasImage?: boolean;
  hasFounder?: boolean;
  hasAnime?: boolean;
  sortBy?: 'name' | 'foundedYear' | 'animeCount' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface StudioProjectItem {
  id: string;
  slug: string;
  canonicalTitle: string;
  englishTitle?: string | null;
  posterUrl: string;
  score?: number | null;
  episodes?: number | null;
  type: string;
  status: string;
  year?: number | null;
  role: StudioRole;
  isMain: boolean;
  isPrimary: boolean;
}

export interface StudioDetailItem {
  id: string;
  name: string;
  displayTitle: string;
  nativeName?: string | null;
  romanizedName?: string | null;
  alternativeNames: string[];
  slug: string;
  about?: string | null;
  displayDescription?: string | null;
  shortDescription?: string | null;
  descriptionSource: string;
  foundedDate?: Date | null;
  foundedYear?: number | null;
  dissolvedDate?: Date | null;
  status: StudioStatus;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  website?: string | null;
  wikipediaUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  imageUrl?: string | null;
  displayImageUrl?: string | null;
  bannerUrl?: string | null;
  verificationStatus: StudioVerificationStatus;
  publicationState: StudioPublicationState;
  hasAdminOverride: boolean;
  adminNotes?: string | null;
  externalLinks: StudioExternalReference[];
  metadata?: Record<string, any>;
  totalAnimeCount: number;
  projects: StudioProjectItem[];
  staff: Array<{
    id: string;
    personId: string;
    name: string;
    slug?: string | null;
    nameKanji?: string | null;
    imageUrl?: string | null;
    role: StudioPersonRole;
    tenureStartYear?: number | null;
    tenureEndYear?: number | null;
    isCurrent: boolean;
    notes?: string | null;
  }>;
  relatedStudios: Array<{
    id: string;
    studioId: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    relationshipType: StudioRelationshipType;
    establishedYear?: number | null;
    notes?: string | null;
  }>;
  newsRelations: Array<{
    id: string;
    title: string;
    slug: string;
    publishedAt: Date;
    sourceName: string;
    imageUrl?: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DuplicateCandidateMatch {
  studio: {
    id: string;
    name: string;
    slug: string;
    foundedYear?: number | null;
    website?: string | null;
    imageUrl?: string | null;
    animeCount: number;
  };
  matchType: 'EXACT_NAME' | 'EXACT_SLUG' | 'NAME_SIMILARITY' | 'ALT_NAME' | 'WEBSITE';
  confidenceScore: number;
  reason: string;
}

export interface MergeStudioInput {
  primaryStudioId: string;
  secondaryStudioId: string;
  reason: string;
  keepSecondaryAsAlias?: boolean;
}
