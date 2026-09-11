export type AnimeType = 'TV' | 'Movie' | 'OVA' | 'ONA' | 'Special';

export type AiringStatus = 'Airing' | 'Finished' | 'Upcoming';

export type UserWatchStatus = 'watching' | 'completed' | 'plan_to_watch' | 'on_hold' | 'dropped';

export interface Anime {
  id: string;
  slug?: string;
  externalId?: string;
  externalSource?: 'mal' | 'anilist';
  title: string;
  englishTitle?: string;
  japaneseTitle?: string;
  romajiTitle?: string;
  synopsis: string;
  type: AnimeType;
  episodes: number | null;
  status: AiringStatus;
  season?: 'Winter' | 'Spring' | 'Summer' | 'Fall';
  year?: number;
  score: number | null;
  ratingCount?: number;
  /** Number of ratings behind the external `score`. */
  scoredBy?: number | null;
  /** Average of OTAKUVA members' ratings, when anyone has rated. */
  otakuvaScore?: number | null;
  otakuvaRatingCount?: number;
  rank?: number;
  popularity?: number;
  posterImage: string;
  bannerImage?: string;
  trailerUrl?: string;
  genres: string[];
  themes?: string[];
  studios: string[];
  duration?: string;
  source?: string;
  members?: number;
  favoritesCount?: number;
}

export interface UserAnimeProgress {
  animeId: string;
  status: UserWatchStatus;
  episodesWatched: number;
  totalEpisodes: number | null;
  personalScore?: number;
  isFavorite?: boolean;
  notes?: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
}

export interface Episode {
  id: string;
  animeId: string;
  number: number;
  title: string;
  japaneseTitle?: string;
  airDate?: string;
  duration?: string;
  score?: number;
  ratingCount?: number;
  isFiller?: boolean;
  isRecap?: boolean;
}

export interface FilterState {
  searchQuery: string;
  genre: string;
  status: string;
  season: string;
  year: string;
  type: string;
  sortBy: 'score' | 'popularity' | 'trending' | 'title' | 'recently_added';
}
