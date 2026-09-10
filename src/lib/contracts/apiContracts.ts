/**
 * OTAKUVA API FOUNDATION — PHASE 3 CONTRACTS
 * 
 * Standardized API response contracts, request parameters, pagination schemas,
 * and canonical entity DTOs across the entire OTAKUVA platform.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  cached?: boolean;
  executionTimeMs?: number;
  error?: ApiErrorPayload | null;
  // Legacy / backward-compatibility envelopes
  [key: string]: any;
}

export type AnimeType = 'TV' | 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL' | 'MUSIC' | 'TV_SPECIAL' | 'OTHER' | 'UNKNOWN';
export type AnimeStatus = 'FINISHED' | 'AIRING' | 'NOT_YET_AIRED' | 'CANCELLED' | 'HIATUS' | 'UNKNOWN';
export type SeasonType = 'MAIN' | 'SPECIAL' | 'OVA' | 'ONA' | 'MOVIE' | 'RECAP';
export type SortField = 'score' | 'popularity' | 'members' | 'rank' | 'year' | 'title' | 'updatedAt' | 'trending' | 'episodes';
export type SortOrder = 'asc' | 'desc';

export interface AnimeFilterParams {
  q?: string;
  genre?: string;
  theme?: string;
  studio?: string;
  type?: string;
  status?: string;
  season?: string;
  year?: number;
  decade?: string;
  minScore?: number;
  maxScore?: number;
  country?: string;
  isAdult?: boolean;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}

export interface AnimeTitleDto {
  type: string;
  title: string;
  language?: string | null;
  isPrimary?: boolean;
}

export interface StudioDto {
  id: string;
  name: string;
  slug: string;
  isMain?: boolean;
  isPrimary?: boolean;
}

export interface ProducerDto {
  id: string;
  name: string;
  slug: string;
}

export interface AnimeCardDto {
  id: string;
  externalId?: string | null;
  externalSource: string;
  malId?: number | null;
  anilistId?: number | null;
  slug: string;
  title: string;
  canonicalTitle: string;
  englishTitle?: string | null;
  japaneseTitle?: string | null;
  synopsis?: string | null;
  type: string;
  status: string;
  episodes?: number | null;
  score?: number | null;
  scoredBy?: number | null;
  rank?: number | null;
  popularity?: number | null;
  members?: number | null;
  favorites?: number | null;
  posterUrl: string;
  largePosterUrl?: string | null;
  posterImage: string;
  bannerUrl?: string | null;
  bannerImage?: string | null;
  trailerUrl?: string | null;
  season?: string | null;
  year?: number | null;
  startDate?: string | null;
  datePrecision?: string;
  nextAiringEpisode?: number | null;
  nextAiringAt?: string | null;
  timeUntilAiring?: number | null;
  genres: string[];
  themes: string[];
  studios: string[];
}

export interface AnimeDetailDto extends AnimeCardDto {
  background?: string | null;
  source?: string | null;
  country?: string | null;
  isAdult: boolean;
  duration?: string | null;
  rating?: string | null;
  endDate?: string | null;
  broadcastDay?: string | null;
  broadcastTime?: string | null;
  broadcastTimezone?: string | null;
  dataCompletenessScore?: number | null;
  titles: AnimeTitleDto[];
  tags: { name: string; rank?: number | null; description?: string | null; isMediaSpoiler?: boolean }[];
  producers: ProducerDto[];
  episodesList: EpisodeDto[];
  directSeasons?: SeasonSummaryDto[];
  characters: {
    id: string;
    name: string;
    nameKanji?: string | null;
    about?: string | null;
    imageUrl?: string | null;
    role: string;
    voiceActors: {
      id: string;
      name: string;
      nameKanji?: string | null;
      imageUrl?: string | null;
      language: string;
    }[];
  }[];
  staff: {
    id: string;
    name: string;
    nameKanji?: string | null;
    imageUrl?: string | null;
    role: string;
  }[];
  relations: {
    relationType: string;
    targetAnime: {
      id: string;
      slug: string;
      title: string;
      canonicalTitle: string;
      type: string;
      posterUrl: string;
      score?: number | null;
      year?: number | null;
    };
  }[];
  franchise?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    productions: {
      id: string;
      slug: string;
      title: string;
      canonicalTitle: string;
      type: string;
      year?: number | null;
      relationship: string;
      posterUrl: string;
      score?: number | null;
    }[];
  } | null;
  userTracking?: {
    status: string;
    episodesWatched: number;
    score?: number | null;
    favorite: boolean;
    notes?: string | null;
    startDate?: string | null;
    finishDate?: string | null;
  } | null;
  watchedEpisodeIds?: string[];
  discussions?: any[];
  communities?: any[];
}

export interface SeasonSummaryDto {
  id: string;
  seasonNumber: number;
  title: string;
  slug?: string | null;
  description?: string | null;
  coverImage?: string | null;
  year?: number | null;
  seasonType: string;
  startDate?: string | null;
  endDate?: string | null;
  episodeCount: number;
  sortOrder: number;
  watchedCount?: number;
  episodes?: EpisodeDto[];
}

export interface EpisodeDto {
  id: string;
  animeId: string;
  seasonId?: string | null;
  number: number;
  absoluteEpisodeNumber?: number | null;
  canonicalOrder?: number | null;
  title?: string | null;
  titleJapanese?: string | null;
  synopsis?: string | null;
  airedAt?: string | null;
  duration?: string | null;
  filler: boolean;
  recap: boolean;
  status: string;
  imageUrl?: string | null;
  isWatched?: boolean;
  userRating?: number | null;
}

export interface EpisodeDetailDto extends EpisodeDto {
  anime: {
    id: string;
    slug: string;
    title: string;
    canonicalTitle: string;
    posterUrl: string;
    type: string;
    totalEpisodes?: number | null;
  };
  season?: {
    id: string;
    seasonNumber: number;
    title: string;
    seasonType: string;
  } | null;
  previousEpisode?: {
    id: string;
    number: number;
    title?: string | null;
  } | null;
  nextEpisode?: {
    id: string;
    number: number;
    title?: string | null;
  } | null;
}
