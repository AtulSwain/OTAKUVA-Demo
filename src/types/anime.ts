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
  // Object shape carries the real DB slug so links to /studio/[slug] don't
  // have to guess one from the name; plain strings kept for older callers.
  studios: (string | { id: string; name: string; slug: string | null })[];
  duration?: string;
  source?: string;
  members?: number;
  favoritesCount?: number;
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
