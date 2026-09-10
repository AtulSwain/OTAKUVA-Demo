export interface ProviderPagination {
  currentPage: number;
  lastVisiblePage: number;
  hasNextPage: boolean;
  itemsCount?: number;
  totalItems?: number;
}

export interface ProviderAnimeTitle {
  type: 'official' | 'english' | 'japanese' | 'romaji' | 'synonym' | 'alternative';
  title: string;
  language?: string | null;
}

export interface ProviderDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
  date?: Date | null;
  precision: 'YEAR' | 'MONTH' | 'DAY' | 'UNKNOWN';
}

export interface ProviderTag {
  name: string;
  description?: string | null;
  rank?: number | null;
  isMediaSpoiler?: boolean;
}

export interface ProviderAnime {
  externalId: string;
  externalSource: 'anilist' | 'mal' | 'kitsu';
  malId?: number | null;
  anilistId?: number | null;
  title: string;
  titles: ProviderAnimeTitle[];
  synopsis: string;
  background?: string | null;
  type: string; // TV, Movie, OVA, ONA, Special, Music
  source?: string | null; // Manga, Light Novel, Original, etc.
  status: string; // Finished, Airing, Not Yet Aired, Cancelled, Hiatus
  country?: string | null;
  isAdult?: boolean;
  episodes?: number | null;
  duration?: string | null;
  rating?: string | null;
  startDate?: ProviderDate | null;
  endDate?: ProviderDate | null;
  season?: string | null;
  year?: number | null;
  broadcastDay?: string | null;
  broadcastTime?: string | null;
  broadcastTimezone?: string | null;
  score?: number | null;
  scoredBy?: number | null;
  rank?: number | null;
  popularity?: number | null;
  members?: number | null;
  favorites?: number | null;
  posterUrl: string;
  largePosterUrl?: string | null;
  bannerUrl?: string | null;
  trailerUrl?: string | null;
  genres: string[];
  themes: string[];
  tags?: ProviderTag[];
  studios: { name: string; isMain?: boolean }[];
  producers: string[];
  licensors: string[];
}

export interface ProviderEpisode {
  externalId?: string | null;
  number: number;
  title?: string | null;
  titleJapanese?: string | null;
  synopsis?: string | null;
  airedAt?: string | null;
  duration?: string | null;
  filler: boolean;
  recap: boolean;
  imageUrl?: string | null;
  externalUrl?: string | null;
}

export interface ProviderCharacter {
  externalId: string;
  name: string;
  nameKanji?: string | null;
  about?: string | null;
  imageUrl?: string | null;
  role: 'Main' | 'Supporting' | 'Background';
  voiceActors: {
    personExternalId: string;
    personName: string;
    personKanji?: string | null;
    personImage?: string | null;
    language: string;
  }[];
}

export interface ProviderStaff {
  personExternalId: string;
  personName: string;
  personKanji?: string | null;
  personImage?: string | null;
  positions: string[];
}

export interface ProviderRelation {
  relationType: string; // PREQUEL, SEQUEL, SIDE_STORY, SPIN_OFF, ALTERNATIVE, ADAPTATION, SUMMARY, OTHER
  relatedExternalId: string;
  relatedTitle: string;
  format?: string | null;
}

export interface ProviderVideo {
  externalId?: string | null;
  title: string;
  type: string;
  url: string;
  thumbnailUrl?: string | null;
}

export interface ProviderPicture {
  imageUrl: string;
  largeImageUrl?: string | null;
}

export interface ProviderNewsItem {
  externalId: string;
  title: string;
  url: string;
  date: string;
  authorUsername?: string;
  authorUrl?: string;
  forumUrl?: string;
  images?: {
    jpg?: { imageUrl?: string };
  };
  comments?: number;
  excerpt?: string;
}

export interface ProviderRecommendationItem {
  entry: {
    malId: number;
    url: string;
    title: string;
    images?: {
      jpg?: { imageUrl?: string; largeImageUrl?: string };
    };
  };
  votes: number;
}

export interface ProviderReviewItem {
  malId: number;
  url: string;
  type: string;
  votes: number;
  date: string;
  review: string;
  score: number;
  tags?: string[];
  isSpoiler?: boolean;
  isPreliminary?: boolean;
  episodesWatched?: number;
  user: {
    username: string;
    url: string;
    images?: {
      jpg?: { imageUrl?: string };
    };
  };
}

export interface ProviderStreamingLink {
  name: string;
  url: string;
}

export interface ProviderStatistics {
  watching: number;
  completed: number;
  onHold: number;
  dropped: number;
  planToWatch: number;
  total: number;
  scores: Record<number, number>;
}

export interface AnimeDataProvider {
  name: 'anilist' | 'jikan';
  searchAnime(query: string, page?: number, limit?: number): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }>;
  getAnime(externalId: string): Promise<ProviderAnime | null>;
  getAnimeList(page?: number, limit?: number): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }>;
  getAnimeEpisodes(externalId: string, page?: number): Promise<{ episodes: ProviderEpisode[]; pagination: ProviderPagination }>;
  getAnimeCharacters(externalId: string): Promise<ProviderCharacter[]>;
  getAnimeStaff(externalId: string): Promise<ProviderStaff[]>;
  getAnimeRelations(externalId: string): Promise<ProviderRelation[]>;
  getAnimeVideos?(externalId: string): Promise<ProviderVideo[]>;
  getAnimePictures?(externalId: string): Promise<ProviderPicture[]>;
  getAnimeNews?(externalId: string): Promise<ProviderNewsItem[]>;
  getAnimeRecommendations?(externalId: string): Promise<ProviderRecommendationItem[]>;
  getAnimeReviews?(externalId: string, page?: number): Promise<ProviderReviewItem[]>;
  getAnimeStreaming?(externalId: string): Promise<ProviderStreamingLink[]>;
  getAnimeStatistics?(externalId: string): Promise<ProviderStatistics | null>;
  getTopAnime(page?: number, limit?: number): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }>;
  getSeasonalAnime(year: number, season: string, page?: number, limit?: number): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }>;
  getUpcomingAnime(page?: number, limit?: number): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }>;
  getHistoricalAnime(startYear: number, endYear: number, page?: number, limit?: number): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }>;
}

export type AnimeProvider = AnimeDataProvider;
