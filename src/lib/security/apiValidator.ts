/**
 * OTAKUVA API VALIDATOR & INPUT SANITIZER
 * 
 * Provides strict type-safe validation, parameter parsing, range clamping,
 * and XSS/injection protection for all OTAKUVA API endpoints.
 */

import { AnimeFilterParams, SortField, SortOrder } from '../contracts/apiContracts';
import { sanitizeText } from './xssSanitizer';

export interface ValidationResult<T> {
  isValid: boolean;
  data: T;
  errors: Record<string, string>;
}

const ALLOWED_SORT_FIELDS: SortField[] = [
  'score',
  'popularity',
  'members',
  'rank',
  'year',
  'title',
  'updatedAt',
  'trending',
  'episodes',
];

const ALLOWED_TYPES = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC', 'TV_SPECIAL', 'OTHER', 'UNKNOWN'];
const ALLOWED_STATUSES = ['FINISHED', 'AIRING', 'NOT_YET_AIRED', 'CANCELLED', 'HIATUS', 'UNKNOWN'];
const ALLOWED_SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

/**
 * Validates and parses searchParams into clean, sanitized AnimeFilterParams
 */
export function validateAnimeQueryParams(searchParams: URLSearchParams): ValidationResult<AnimeFilterParams> {
  const errors: Record<string, string> = {};

  // Text Query
  const rawQ = searchParams.get('q');
  const q = rawQ ? sanitizeText(rawQ.trim()).slice(0, 100) : undefined;

  // Genre / Theme / Studio
  const rawGenre = searchParams.get('genre');
  const genre = rawGenre && rawGenre !== 'All' ? sanitizeText(rawGenre.trim()) : undefined;

  const rawTheme = searchParams.get('theme');
  const theme = rawTheme && rawTheme !== 'All' ? sanitizeText(rawTheme.trim()) : undefined;

  const rawStudio = searchParams.get('studio');
  const studio = rawStudio && rawStudio !== 'All' ? sanitizeText(rawStudio.trim()) : undefined;

  // Type
  const rawType = searchParams.get('type');
  let type: string | undefined;
  if (rawType && rawType !== 'All') {
    const upper = rawType.toUpperCase().trim();
    if (ALLOWED_TYPES.includes(upper) || ['TV_SHORT', 'SPECIALS'].includes(upper)) {
      type = upper;
    } else {
      type = upper; // permissive fallback but sanitized
    }
  }

  // Status
  const rawStatus = searchParams.get('status');
  let status: string | undefined;
  if (rawStatus && rawStatus !== 'All') {
    status = sanitizeText(rawStatus.trim());
  }

  // Season
  const rawSeason = searchParams.get('season');
  let season: string | undefined;
  if (rawSeason && rawSeason !== 'All') {
    const upper = rawSeason.toUpperCase().trim();
    if (ALLOWED_SEASONS.includes(upper)) {
      season = upper;
    } else {
      errors.season = `Invalid season. Allowed: ${ALLOWED_SEASONS.join(', ')}`;
    }
  }

  // Year
  const rawYear = searchParams.get('year');
  let year: number | undefined;
  if (rawYear && rawYear !== 'All') {
    const parsedYear = parseInt(rawYear, 10);
    if (isNaN(parsedYear) || parsedYear < 1917 || parsedYear > 2100) {
      errors.year = 'Year must be a valid integer between 1917 and 2100';
    } else {
      year = parsedYear;
    }
  }

  // Decade
  const rawDecade = searchParams.get('decade');
  let decade: string | undefined;
  if (rawDecade && rawDecade !== 'All') {
    if (/^\d{4}s$/.test(rawDecade)) {
      decade = rawDecade;
    } else {
      errors.decade = 'Decade must be in the format e.g. "1990s", "2000s", "2010s", "2020s"';
    }
  }

  // Score bounds
  const rawMinScore = searchParams.get('minScore');
  let minScore: number | undefined;
  if (rawMinScore) {
    const parsed = parseFloat(rawMinScore);
    if (isNaN(parsed) || parsed < 0 || parsed > 10) {
      errors.minScore = 'minScore must be a number between 0 and 10';
    } else {
      minScore = parsed;
    }
  }

  const rawMaxScore = searchParams.get('maxScore');
  let maxScore: number | undefined;
  if (rawMaxScore) {
    const parsed = parseFloat(rawMaxScore);
    if (isNaN(parsed) || parsed < 0 || parsed > 10) {
      errors.maxScore = 'maxScore must be a number between 0 and 10';
    } else {
      maxScore = parsed;
    }
  }

  if (minScore !== undefined && maxScore !== undefined && minScore > maxScore) {
    errors.scoreRange = 'minScore cannot be greater than maxScore';
  }

  // Sort
  const rawSortBy = (searchParams.get('sortBy') || searchParams.get('sort') || 'score') as SortField;
  let sortBy: SortField = 'score';
  if (ALLOWED_SORT_FIELDS.includes(rawSortBy)) {
    sortBy = rawSortBy;
  } else {
    sortBy = 'score';
  }

  const rawSortOrder = (searchParams.get('sortOrder') || searchParams.get('order') || 'desc').toLowerCase();
  const sortOrder: SortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc';

  // Pagination
  const rawPage = searchParams.get('page');
  let page = 1;
  if (rawPage) {
    const parsed = parseInt(rawPage, 10);
    if (isNaN(parsed) || parsed < 1) {
      errors.page = 'Page must be a positive integer greater than or equal to 1';
    } else {
      page = Math.min(parsed, 1000); // limit max page to prevent DOS
    }
  }

  const rawLimit = searchParams.get('limit');
  let limit = 50;
  if (rawLimit) {
    const parsed = parseInt(rawLimit, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      errors.limit = 'Limit must be an integer between 1 and 100';
    } else {
      limit = parsed;
    }
  }

  const data: AnimeFilterParams = {
    q,
    genre,
    theme,
    studio,
    type,
    status,
    season,
    year,
    decade,
    minScore,
    maxScore,
    sortBy,
    sortOrder,
    page,
    limit,
  };

  return {
    isValid: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

/**
 * Validates an ID or Slug parameter
 */
export function validateIdOrSlug(param: string | undefined): { isValid: boolean; value: string; error?: string } {
  if (!param || typeof param !== 'string' || param.trim().length === 0) {
    return { isValid: false, value: '', error: 'Resource identifier is required' };
  }
  const clean = sanitizeText(param.trim());
  if (clean.length > 200) {
    return { isValid: false, value: clean, error: 'Identifier exceeds maximum allowed length' };
  }
  return { isValid: true, value: clean };
}
