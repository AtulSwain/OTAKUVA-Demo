import {
  AnimeProvider,
  ProviderAnime,
  ProviderEpisode,
  ProviderCharacter,
  ProviderStaff,
  ProviderRelation,
  ProviderVideo,
  ProviderStatistics,
  ProviderPagination,
  ProviderAnimeTitle,
  ProviderDate,
  ProviderTag,
} from './animeProvider.interface';

const ANILIST_GRAPHQL = process.env.ANILIST_BASE_URL || 'https://graphql.anilist.co';
const ANILIST_TOKEN = process.env.ANILIST_TOKEN || '';

export interface AniListAiringItem {
  id: number;
  airingAt: number; // Unix timestamp
  timeUntilAiring: number; // seconds
  episode: number;
  media: {
    id: number;
    idMal?: number;
    title: {
      romaji?: string;
      english?: string;
      native?: string;
    };
    format?: string;
    status?: string;
    episodes?: number;
    coverImage?: {
      large?: string;
      extraLarge?: string;
    };
    bannerImage?: string;
    genres?: string[];
    averageScore?: number;
  };
}

class RateLimiter {
  private lastRequest = 0;
  private minIntervalMs = 700; // ~85 req/min, safe under 90 req/min limit

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastRequest = Date.now();
  }
}

const rateLimiter = new RateLimiter();

async function graphql(query: string, variables: any = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await rateLimiter.throttle();
      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'OTAKUVA/1.0 (Anime Culture & Knowledge Platform)',
      };
      if (ANILIST_TOKEN) headers['Authorization'] = `Bearer ${ANILIST_TOKEN}`;

      const res = await fetch(ANILIST_GRAPHQL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
        console.warn(`AniList rate limited (429). Backing off for ${retryAfter}s (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
        continue;
      }

      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          await new Promise((r) => setTimeout(r, attempt * 1500));
          continue;
        }
        throw new Error(`AniList GraphQL error ${res.status}`);
      }

      const json = await res.json();
      if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors.map((e: any) => e.message).join('; '));
      }
      return json.data;
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}

function parseFuzzyDate(dateObj: any): ProviderDate | null {
  if (!dateObj || (!dateObj.year && !dateObj.month && !dateObj.day)) return null;
  const year = dateObj.year || null;
  const month = dateObj.month || null;
  const day = dateObj.day || null;

  let precision: 'YEAR' | 'MONTH' | 'DAY' | 'UNKNOWN' = 'UNKNOWN';
  if (year && month && day) {
    precision = 'DAY';
  } else if (year && month) {
    precision = 'MONTH';
  } else if (year) {
    precision = 'YEAR';
  }

  let date: Date | null = null;
  if (year) {
    date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  }

  return { year, month, day, date, precision };
}

function mapTitles(media: any): ProviderAnimeTitle[] {
  const titles: ProviderAnimeTitle[] = [];
  if (media.title?.romaji) titles.push({ type: 'romaji', title: media.title.romaji, language: 'ja' });
  if (media.title?.english) titles.push({ type: 'english', title: media.title.english, language: 'en' });
  if (media.title?.native) titles.push({ type: 'japanese', title: media.title.native, language: 'ja' });
  if (Array.isArray(media.synonyms)) {
    media.synonyms.forEach((s: string) => {
      if (s && !titles.some((t) => t.title === s)) {
        titles.push({ type: 'synonym', title: s });
      }
    });
  }
  if (!titles.some((t) => t.type === 'official')) {
    const primary = media.title?.english || media.title?.romaji || media.title?.native;
    if (primary) titles.unshift({ type: 'official', title: primary });
  }
  return titles;
}

function mapFormat(format: string): string {
  switch (format) {
    case 'TV_SHORT':
    case 'TV':
      return 'TV';
    case 'MOVIE':
      return 'Movie';
    case 'OVA':
      return 'OVA';
    case 'ONA':
      return 'ONA';
    case 'SPECIAL':
      return 'Special';
    case 'MUSIC':
      return 'Music';
    default:
      return 'TV';
  }
}

function mapStatus(status: string): string {
  switch (status) {
    case 'FINISHED':
      return 'Finished';
    case 'RELEASING':
      return 'Airing';
    case 'NOT_YET_RELEASED':
      return 'Not Yet Aired';
    case 'CANCELLED':
      return 'Cancelled';
    case 'HIATUS':
      return 'Hiatus';
    default:
      return 'Finished';
  }
}

function mapSource(source: string): string {
  switch (source) {
    case 'MANGA':
      return 'Manga';
    case 'LIGHT_NOVEL':
      return 'Light Novel';
    case 'VISUAL_NOVEL':
      return 'Visual Novel';
    case 'VIDEO_GAME':
      return 'Video Game';
    case 'ORIGINAL':
      return 'Original';
    case 'NOVEL':
      return 'Novel';
    case 'WEB_NOVEL':
      return 'Web Novel';
    default:
      return source ? source.replace(/_/g, ' ') : 'Original';
  }
}

function mapStudiosAndProducers(media: any): {
  studios: { name: string; isMain?: boolean }[];
  producers: string[];
} {
  const studios: { name: string; isMain?: boolean }[] = [];
  const producers: string[] = [];

  if (media.studios?.edges && Array.isArray(media.studios.edges)) {
    media.studios.edges.forEach((edge: any) => {
      const name = edge.node?.name;
      if (!name) return;
      const isAnimationStudio = Boolean(edge.node?.isAnimationStudio || edge.isMain);
      if (isAnimationStudio) {
        studios.push({ name, isMain: Boolean(edge.isMain) });
      } else {
        producers.push(name);
      }
    });
  }

  // Fallback: If no animation studio was marked as main, take the first studio
  if (studios.length === 0 && producers.length > 0) {
    studios.push({ name: producers.shift()!, isMain: true });
  }

  return { studios, producers };
}

function mapTags(media: any): ProviderTag[] {
  if (!Array.isArray(media.tags)) return [];
  return media.tags.map((t: any) => ({
    name: t.name,
    description: t.description || null,
    rank: t.rank || 0,
    isMediaSpoiler: t.isMediaSpoiler || false,
  }));
}

function mapAniListAnime(media: any): ProviderAnime {
  const titles = mapTitles(media);
  const canonicalTitle = media.title?.english || media.title?.romaji || media.title?.native || 'Untitled Anime';
  const startDate = parseFuzzyDate(media.startDate);
  const endDate = parseFuzzyDate(media.endDate);
  const { studios, producers } = mapStudiosAndProducers(media);

  return {
    externalId: String(media.id),
    externalSource: 'anilist',
    malId: media.idMal || null,
    anilistId: media.id,
    title: canonicalTitle,
    titles,
    synopsis: media.description ? media.description.replace(/<[^>]*>?/gm, '').trim() : 'No synopsis available.',
    type: mapFormat(media.format),
    source: mapSource(media.source),
    status: mapStatus(media.status),
    country: media.countryOfOrigin || 'JP',
    isAdult: media.isAdult || false,
    episodes: media.episodes || null,
    duration: media.duration ? `${media.duration} mins` : null,
    startDate,
    endDate,
    season: media.season ? media.season.charAt(0) + media.season.slice(1).toLowerCase() : null,
    year: media.seasonYear || (startDate?.year ?? null),
    score: typeof media.averageScore === 'number' ? media.averageScore / 10 : null,
    popularity: media.popularity || null,
    favorites: media.favourites || null,
    posterUrl: media.coverImage?.large || media.coverImage?.extraLarge || media.coverImage?.medium || '',
    largePosterUrl: media.coverImage?.extraLarge || media.coverImage?.large || null,
    bannerUrl: media.bannerImage || null,
    trailerUrl: media.trailer?.id && media.trailer?.site === 'youtube'
      ? `https://www.youtube.com/watch?v=${media.trailer.id}`
      : null,
    genres: Array.isArray(media.genres) ? media.genres : [],
    themes: [],
    tags: mapTags(media),
    studios,
    producers,
    licensors: [],
  };
}

const MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  synonyms
  description
  format
  status
  source
  countryOfOrigin
  isAdult
  episodes
  duration
  startDate {
    year
    month
    day
  }
  endDate {
    year
    month
    day
  }
  season
  seasonYear
  averageScore
  popularity
  favourites
  coverImage {
    extraLarge
    large
    medium
  }
  bannerImage
  trailer {
    id
    site
  }
  genres
  tags {
    name
    description
    rank
    isMediaSpoiler
  }
  studios {
    edges {
      isMain
      node {
        id
        name
        isAnimationStudio
      }
    }
  }
`;

export class AniListProvider implements AnimeProvider {
  public name: 'anilist' = 'anilist';

  async searchAnime(query: string, page = 1, limit = 20): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const gql = `
      query ($query: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            currentPage
            lastPage
            hasNextPage
            total
          }
          media(search: $query, type: ANIME, sort: SEARCH_MATCH) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await graphql(gql, { query, page, perPage: limit });
    const pageInfo = data?.Page?.pageInfo || {};
    const media = data?.Page?.media || [];

    return {
      items: media.map(mapAniListAnime),
      pagination: {
        currentPage: pageInfo.currentPage || page,
        lastVisiblePage: pageInfo.lastPage || page,
        hasNextPage: Boolean(pageInfo.hasNextPage),
        totalItems: pageInfo.total || 0,
      },
    };
  }

  async getAnime(externalId: string): Promise<ProviderAnime | null> {
    const id = parseInt(externalId, 10);
    if (isNaN(id)) return null;

    const gql = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          ${MEDIA_FIELDS}
        }
      }
    `;
    try {
      const data = await graphql(gql, { id });
      if (!data?.Media) return null;
      return mapAniListAnime(data.Media);
    } catch {
      return null;
    }
  }

  async getAnimeList(page = 1, limit = 50): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const gql = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            currentPage
            lastPage
            hasNextPage
            total
          }
          media(type: ANIME, sort: POPULARITY_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await graphql(gql, { page, perPage: limit });
    const pageInfo = data?.Page?.pageInfo || {};
    const media = data?.Page?.media || [];

    return {
      items: media.map(mapAniListAnime),
      pagination: {
        currentPage: pageInfo.currentPage || page,
        lastVisiblePage: pageInfo.lastPage || page,
        hasNextPage: Boolean(pageInfo.hasNextPage),
        totalItems: pageInfo.total || 0,
      },
    };
  }

  async getTopAnime(page = 1, limit = 50): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    return this.getAnimeList(page, limit);
  }

  async getSeasonalAnime(year: number, season: string, page = 1, limit = 50): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const gql = `
      query ($seasonYear: Int, $season: MediaSeason, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            currentPage
            lastPage
            hasNextPage
            total
          }
          media(seasonYear: $seasonYear, season: $season, type: ANIME, sort: POPULARITY_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const seasonUpper = season.toUpperCase();
    const data = await graphql(gql, { seasonYear: year, season: seasonUpper, page, perPage: limit });
    const pageInfo = data?.Page?.pageInfo || {};
    const media = data?.Page?.media || [];

    return {
      items: media.map(mapAniListAnime),
      pagination: {
        currentPage: pageInfo.currentPage || page,
        lastVisiblePage: pageInfo.lastPage || page,
        hasNextPage: Boolean(pageInfo.hasNextPage),
        totalItems: pageInfo.total || 0,
      },
    };
  }

  async getUpcomingAnime(page = 1, limit = 50): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const gql = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            currentPage
            lastPage
            hasNextPage
            total
          }
          media(status: NOT_YET_RELEASED, type: ANIME, sort: POPULARITY_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await graphql(gql, { page, perPage: limit });
    const pageInfo = data?.Page?.pageInfo || {};
    const media = data?.Page?.media || [];

    return {
      items: media.map(mapAniListAnime),
      pagination: {
        currentPage: pageInfo.currentPage || page,
        lastVisiblePage: pageInfo.lastPage || page,
        hasNextPage: Boolean(pageInfo.hasNextPage),
        totalItems: pageInfo.total || 0,
      },
    };
  }

  async getHistoricalAnime(startYear: number, endYear: number, page = 1, limit = 50): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const startDateGreater = startYear * 10000;
    const startDateLesser = (endYear + 1) * 10000;

    const gql = `
      query ($startDate_greater: FuzzyDateInt, $startDate_lesser: FuzzyDateInt, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            currentPage
            lastPage
            hasNextPage
            total
          }
          media(startDate_greater: $startDate_greater, startDate_lesser: $startDate_lesser, type: ANIME, sort: POPULARITY_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await graphql(gql, { startDate_greater: startDateGreater, startDate_lesser: startDateLesser, page, perPage: limit });
    const pageInfo = data?.Page?.pageInfo || {};
    const media = data?.Page?.media || [];

    return {
      items: media.map(mapAniListAnime),
      pagination: {
        currentPage: pageInfo.currentPage || page,
        lastVisiblePage: pageInfo.lastPage || page,
        hasNextPage: Boolean(pageInfo.hasNextPage),
        totalItems: pageInfo.total || 0,
      },
    };
  }

  async getAnimeEpisodes(externalId: string, page = 1): Promise<{ episodes: ProviderEpisode[]; pagination: ProviderPagination }> {
    const id = parseInt(externalId, 10);
    if (isNaN(id)) return { episodes: [], pagination: { currentPage: 1, lastVisiblePage: 1, hasNextPage: false } };

    const gql = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          episodes
          streamingEpisodes {
            title
            thumbnail
            url
            site
          }
        }
      }
    `;
    try {
      const data = await graphql(gql, { id });
      const media = data?.Media;
      const episodes: ProviderEpisode[] = [];
      const streaming = media?.streamingEpisodes || [];

      if (streaming.length > 0) {
        streaming.forEach((s: any, idx: number) => {
          episodes.push({
            number: idx + 1,
            title: s.title || `Episode ${idx + 1}`,
            imageUrl: s.thumbnail || null,
            externalUrl: s.url || null,
            filler: false,
            recap: false,
          });
        });
      } else if (media?.episodes) {
        for (let i = 1; i <= media.episodes; i++) {
          episodes.push({
            number: i,
            title: `Episode ${i}`,
            filler: false,
            recap: false,
          });
        }
      }

      return {
        episodes,
        pagination: { currentPage: 1, lastVisiblePage: 1, hasNextPage: false, totalItems: episodes.length },
      };
    } catch {
      return { episodes: [], pagination: { currentPage: 1, lastVisiblePage: 1, hasNextPage: false } };
    }
  }

  async getAnimeCharacters(externalId: string): Promise<ProviderCharacter[]> {
    const id = parseInt(externalId, 10);
    if (isNaN(id)) return [];

    const gql = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          characters(perPage: 25, sort: [ROLE, RELEVANCE]) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                }
                description
                image {
                  large
                }
              }
              voiceActors(language: JAPANESE) {
                id
                name {
                  full
                  native
                }
                image {
                  large
                }
                language
              }
            }
          }
        }
      }
    `;
    try {
      const data = await graphql(gql, { id });
      const edges = data?.Media?.characters?.edges || [];

      return edges.map((edge: any) => ({
        externalId: String(edge.node.id),
        name: edge.node.name?.full || 'Unknown Character',
        nameKanji: edge.node.name?.native || null,
        about: edge.node.description || null,
        imageUrl: edge.node.image?.large || null,
        role: edge.role === 'MAIN' ? 'Main' : 'Supporting',
        voiceActors: (edge.voiceActors || []).map((va: any) => ({
          personExternalId: String(va.id),
          personName: va.name?.full || 'Unknown Voice Actor',
          personKanji: va.name?.native || null,
          personImage: va.image?.large || null,
          language: 'Japanese',
        })),
      }));
    } catch {
      return [];
    }
  }

  async getAnimeStaff(externalId: string): Promise<ProviderStaff[]> {
    const id = parseInt(externalId, 10);
    if (isNaN(id)) return [];

    const gql = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          staff(perPage: 25) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                }
                image {
                  large
                }
              }
            }
          }
        }
      }
    `;
    try {
      const data = await graphql(gql, { id });
      const edges = data?.Media?.staff?.edges || [];

      return edges.map((edge: any) => ({
        personExternalId: String(edge.node.id),
        personName: edge.node.name?.full || 'Unknown Staff',
        personKanji: edge.node.name?.native || null,
        personImage: edge.node.image?.large || null,
        positions: edge.role ? [edge.role] : ['Staff'],
      }));
    } catch {
      return [];
    }
  }

  async getAnimeRelations(externalId: string): Promise<ProviderRelation[]> {
    const id = parseInt(externalId, 10);
    if (isNaN(id)) return [];

    const gql = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          relations {
            edges {
              relationType
              node {
                id
                title {
                  romaji
                  english
                  native
                }
                format
              }
            }
          }
        }
      }
    `;
    try {
      const data = await graphql(gql, { id });
      const edges = data?.Media?.relations?.edges || [];

      return edges.map((edge: any) => ({
        relationType: edge.relationType ? edge.relationType.replace(/_/g, ' ') : 'Other',
        relatedExternalId: String(edge.node.id),
        relatedTitle: edge.node.title?.english || edge.node.title?.romaji || edge.node.title?.native || 'Unknown Title',
        format: edge.node.format || null,
      }));
    } catch {
      return [];
    }
  }

  async getAiringSchedule(
    airingAtGreater: number,
    airingAtLesser: number,
    page = 1,
    perPage = 50
  ): Promise<{ items: AniListAiringItem[]; pagination: ProviderPagination }> {
    const gql = `
      query ($airingAt_greater: Int, $airingAt_lesser: Int, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            currentPage
            lastPage
            hasNextPage
            total
          }
          airingSchedules(
            airingAt_greater: $airingAt_greater,
            airingAt_lesser: $airingAt_lesser,
            sort: TIME
          ) {
            id
            airingAt
            timeUntilAiring
            episode
            media {
              id
              idMal
              title {
                romaji
                english
                native
              }
              format
              status
              episodes
              coverImage {
                extraLarge
                large
              }
              bannerImage
              genres
              averageScore
            }
          }
        }
      }
    `;
    const data = await graphql(gql, {
      airingAt_greater: airingAtGreater,
      airingAt_lesser: airingAtLesser,
      page,
      perPage,
    });
    const pageInfo = data?.Page?.pageInfo || {};
    const items = data?.Page?.airingSchedules || [];

    return {
      items,
      pagination: {
        currentPage: pageInfo.currentPage || page,
        lastVisiblePage: pageInfo.lastPage || page,
        hasNextPage: Boolean(pageInfo.hasNextPage),
        totalItems: pageInfo.total || 0,
      },
    };
  }
}

export const anilistProvider = new AniListProvider();
