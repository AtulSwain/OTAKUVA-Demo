/**
 * OTAKUVA TYPED FRONTEND API CLIENT — PHASE 3
 * 
 * Provides type-safe frontend access to OTAKUVA canonical APIs,
 * decoupling UI components from raw fetch URLs and query strings.
 */

import {
  ApiResponse,
  AnimeFilterParams,
  AnimeCardDto,
  AnimeDetailDto,
  SeasonSummaryDto,
  EpisodeDto,
  EpisodeDetailDto,
} from '../contracts/apiContracts';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  const payload = await response.json();

  if (!response.ok) {
    const errorMsg = payload?.error?.message || payload?.error || 'Request failed';
    throw new Error(errorMsg);
  }

  return payload;
}

export const animeApi = {
  /**
   * Fetch catalog with multi-facet filters
   */
  async getCatalog(params: AnimeFilterParams = {}): Promise<ApiResponse<AnimeCardDto[]>> {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.genre && params.genre !== 'All') searchParams.set('genre', params.genre);
    if (params.theme && params.theme !== 'All') searchParams.set('theme', params.theme);
    if (params.studio && params.studio !== 'All') searchParams.set('studio', params.studio);
    if (params.type && params.type !== 'All') searchParams.set('type', params.type);
    if (params.status && params.status !== 'All') searchParams.set('status', params.status);
    if (params.season && params.season !== 'All') searchParams.set('season', params.season);
    if (params.year) searchParams.set('year', params.year.toString());
    if (params.decade && params.decade !== 'All') searchParams.set('decade', params.decade);
    if (params.minScore !== undefined) searchParams.set('minScore', params.minScore.toString());
    if (params.maxScore !== undefined) searchParams.set('maxScore', params.maxScore.toString());
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());

    return fetchJson<AnimeCardDto[]>(`/api/anime?${searchParams.toString()}`);
  },

  /**
   * Fetch complete anime detail by ID or Slug
   */
  async getDetail(idOrSlug: string): Promise<ApiResponse<AnimeDetailDto>> {
    return fetchJson<AnimeDetailDto>(`/api/anime/${encodeURIComponent(idOrSlug)}`);
  },
};

export const seasonApi = {
  /**
   * Fetch all seasons and connected franchise productions for an anime
   */
  async getSeasons(animeIdOrSlug: string): Promise<ApiResponse<{
    animeId: string;
    slug: string;
    directSeasons: SeasonSummaryDto[];
    franchises: any[];
    connectedSeasons: any[];
  }>> {
    return fetchJson(`/api/anime/${encodeURIComponent(animeIdOrSlug)}/seasons`);
  },

  /**
   * Fetch individual season detail by ID
   */
  async getSeasonDetail(seasonId: string): Promise<ApiResponse<{
    season: SeasonSummaryDto;
    anime: { id: string; slug: string; canonicalTitle: string; posterUrl: string };
  }>> {
    return fetchJson(`/api/seasons/${encodeURIComponent(seasonId)}`);
  },
};

export const episodeApi = {
  /**
   * Fetch paginated episode roster for an anime
   */
  async getEpisodes(
    animeIdOrSlug: string,
    params: { page?: number; limit?: number; seasonId?: string; filler?: boolean } = {}
  ): Promise<ApiResponse<EpisodeDto[]>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.seasonId) searchParams.set('seasonId', params.seasonId);
    if (params.filler !== undefined) searchParams.set('filler', params.filler.toString());

    return fetchJson<EpisodeDto[]>(`/api/anime/${encodeURIComponent(animeIdOrSlug)}/episodes?${searchParams.toString()}`);
  },

  /**
   * Fetch single episode detail with navigation links
   */
  async getEpisode(episodeId: string): Promise<ApiResponse<EpisodeDetailDto>> {
    return fetchJson<EpisodeDetailDto>(`/api/episodes/${encodeURIComponent(episodeId)}`);
  },

  /**
   * Toggle episode watch progress
   */
  async toggleWatch(
    animeId: string,
    episodeId: string,
    watched: boolean
  ): Promise<ApiResponse<{
    episodesWatched: number;
    watchedEpisodes: number[];
    userAnime: any;
  }>> {
    return fetchJson(`/api/episodes/${encodeURIComponent(animeId)}`, {
      method: 'POST',
      body: JSON.stringify({ episodeId, watched }),
    });
  },
};

export const scheduleApi = {
  /**
   * Fetch airing schedule
   */
  async getSchedule(params: {
    date?: string;
    from?: string;
    to?: string;
    day?: string;
    library?: boolean;
    libraryOnly?: boolean;
    timezone?: string;
    region?: string;
    status?: string;
    releaseType?: string;
    sort?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params.date) searchParams.set('date', params.date);
    if (params.from) searchParams.set('from', params.from);
    if (params.to) searchParams.set('to', params.to);
    if (params.day && params.day !== 'All') searchParams.set('day', params.day);
    if (params.library || params.libraryOnly) searchParams.set('library', 'true');
    if (params.timezone) searchParams.set('timezone', params.timezone);
    if (params.region) searchParams.set('region', params.region);
    if (params.status) searchParams.set('status', params.status);
    if (params.releaseType) searchParams.set('releaseType', params.releaseType);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());

    return fetchJson(`/api/schedule?${searchParams.toString()}`);
  },

  /**
   * Fetch personalized Up Next schedule
   */
  async getUpNext(params: { timezone?: string; limit?: number } = {}): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params.timezone) searchParams.set('timezone', params.timezone);
    if (params.limit) searchParams.set('limit', params.limit.toString());

    return fetchJson(`/api/schedule/up-next?${searchParams.toString()}`);
  },

  /**
   * Fetch user's active schedule reminders
   */
  async getReminders(params: { timezone?: string } = {}): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params.timezone) searchParams.set('timezone', params.timezone);

    return fetchJson(`/api/schedule/reminders?${searchParams.toString()}`);
  },

  /**
   * Toggle episode release reminder
   */
  async toggleReminder(scheduleId: string, remindBeforeMinutes: number = 10): Promise<ApiResponse<any>> {
    return fetchJson('/api/schedule/reminders', {
      method: 'POST',
      body: JSON.stringify({ scheduleId, remindBeforeMinutes }),
    });
  },

  /**
   * Fetch admin schedule report
   */
  async getAdminReport(): Promise<ApiResponse<any>> {
    return fetchJson('/api/schedule/admin');
  },
};

export const libraryApi = {
  /**
   * Fetch user tracking library
   */
  async getLibrary(): Promise<ApiResponse<any>> {
    return fetchJson('/api/library');
  },
};
