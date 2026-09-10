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
} from './animeProvider.interface';
import { getJikanAnimeCharacters, getJikanAnimeStaff, jikanFetch } from '../jikanService';

export class JikanProvider implements AnimeProvider {
  public name: 'jikan' = 'jikan';
  private request<T = any>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    retries = 3
  ): Promise<T | null> {
    return jikanFetch<T>(endpoint, params, retries);
  }

  private parseJikanDate(dateStr?: string | null, propDate?: any): ProviderDate | null {
    if (propDate?.year) {
      const year = propDate.year || null;
      const month = propDate.month || null;
      const day = propDate.day || null;
      let precision: 'YEAR' | 'MONTH' | 'DAY' | 'UNKNOWN' = 'UNKNOWN';
      if (year && month && day) precision = 'DAY';
      else if (year && month) precision = 'MONTH';
      else if (year) precision = 'YEAR';

      const date = dateStr ? new Date(dateStr) : new Date(Date.UTC(year, (month || 1) - 1, day || 1));
      return { year, month, day, date: isNaN(date.getTime()) ? null : date, precision };
    }

    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      date,
      precision: 'DAY',
    };
  }

  private mapJikanAnime(item: any): ProviderAnime {
    const titles: ProviderAnimeTitle[] = [{ type: 'official', title: item.title, language: 'en' }];
    if (item.title_english) titles.push({ type: 'english', title: item.title_english, language: 'en' });
    if (item.title_japanese) titles.push({ type: 'japanese', title: item.title_japanese, language: 'ja' });

    if (Array.isArray(item.titles)) {
      item.titles.forEach((t: any) => {
        if (t.title && !titles.some((existing) => existing.title === t.title)) {
          titles.push({
            type: t.type?.toLowerCase() === 'synonym' ? 'synonym' : 'alternative',
            title: t.title,
          });
        }
      });
    }

    const startDate = this.parseJikanDate(item.aired?.from, item.aired?.prop?.from);
    const endDate = this.parseJikanDate(item.aired?.to, item.aired?.prop?.to);

    return {
      externalId: String(item.mal_id),
      externalSource: 'mal',
      malId: item.mal_id,
      title: item.title_english || item.title || 'Untitled Anime',
      titles,
      synopsis: item.synopsis || 'No synopsis available.',
      background: item.background || null,
      type: item.type || 'TV',
      source: item.source || 'Original',
      status: item.status || 'Finished',
      episodes: item.episodes || null,
      duration: item.duration || null,
      rating: item.rating || null,
      startDate,
      endDate,
      season: item.season ? item.season.charAt(0).toUpperCase() + item.season.slice(1) : null,
      year: item.year || startDate?.year || null,
      broadcastDay: item.broadcast?.day || null,
      broadcastTime: item.broadcast?.time || null,
      broadcastTimezone: item.broadcast?.timezone || null,
      score: item.score || null,
      scoredBy: item.scored_by || 0,
      rank: item.rank || null,
      popularity: item.popularity || null,
      members: item.members || 0,
      favorites: item.favorites || 0,
      posterUrl: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
      largePosterUrl: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || null,
      bannerUrl: null,
      trailerUrl: item.trailer?.url || (item.trailer?.youtube_id ? `https://www.youtube.com/watch?v=${item.trailer.youtube_id}` : null),
      genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.name) : [],
      themes: Array.isArray(item.themes) ? item.themes.map((t: any) => t.name) : [],
      studios: Array.isArray(item.studios) ? item.studios.map((s: any) => ({ name: s.name, isMain: true })) : [],
      producers: Array.isArray(item.producers) ? item.producers.map((p: any) => p.name) : [],
      licensors: Array.isArray(item.licensors) ? item.licensors.map((l: any) => l.name) : [],
    };
  }

  async searchAnime(query: string, page = 1, limit = 20): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const data = await this.request('/anime', { q: query, page, limit, sfw: true });
    if (!data || !data.data) {
      return { items: [], pagination: { currentPage: page, lastVisiblePage: page, hasNextPage: false, totalItems: 0 } };
    }
    const items = data.data.map((item: any) => this.mapJikanAnime(item));
    const pag = data.pagination || {};
    return {
      items,
      pagination: {
        currentPage: pag.current_page || page,
        lastVisiblePage: pag.last_visible_page || page,
        hasNextPage: Boolean(pag.has_next_page),
        itemsCount: pag.items?.count,
        totalItems: pag.items?.total || 0,
      },
    };
  }

  async getAnime(externalId: string): Promise<ProviderAnime | null> {
    const data = await this.request(`/anime/${externalId}/full`);
    if (!data || !data.data) return null;
    return this.mapJikanAnime(data.data);
  }

  async getAnimeList(page = 1, limit = 25): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    return this.getTopAnime(page, limit);
  }

  async getTopAnime(page = 1, limit = 25): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const data = await this.request('/top/anime', { page, limit });
    if (!data || !data.data) {
      return { items: [], pagination: { currentPage: page, lastVisiblePage: page, hasNextPage: false, totalItems: 0 } };
    }
    const items = data.data.map((item: any) => this.mapJikanAnime(item));
    const pag = data.pagination || {};
    return {
      items,
      pagination: {
        currentPage: pag.current_page || page,
        lastVisiblePage: pag.last_visible_page || page,
        hasNextPage: Boolean(pag.has_next_page),
        itemsCount: pag.items?.count,
        totalItems: pag.items?.total || 0,
      },
    };
  }

  async getSeasonalAnime(year: number, season: string, page = 1, limit = 25): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const data = await this.request(`/seasons/${year}/${season.toLowerCase()}`, { page, limit });
    if (!data || !data.data) {
      return { items: [], pagination: { currentPage: page, lastVisiblePage: page, hasNextPage: false, totalItems: 0 } };
    }
    const items = data.data.map((item: any) => this.mapJikanAnime(item));
    const pag = data.pagination || {};
    return {
      items,
      pagination: {
        currentPage: pag.current_page || page,
        lastVisiblePage: pag.last_visible_page || page,
        hasNextPage: Boolean(pag.has_next_page),
        itemsCount: pag.items?.count,
        totalItems: pag.items?.total || 0,
      },
    };
  }

  async getUpcomingAnime(page = 1, limit = 25): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const data = await this.request('/seasons/upcoming', { page, limit });
    if (!data || !data.data) {
      return { items: [], pagination: { currentPage: page, lastVisiblePage: page, hasNextPage: false, totalItems: 0 } };
    }
    const items = data.data.map((item: any) => this.mapJikanAnime(item));
    const pag = data.pagination || {};
    return {
      items,
      pagination: {
        currentPage: pag.current_page || page,
        lastVisiblePage: pag.last_visible_page || page,
        hasNextPage: Boolean(pag.has_next_page),
        itemsCount: pag.items?.count,
        totalItems: pag.items?.total || 0,
      },
    };
  }


  async getHistoricalAnime(startYear: number, endYear: number, page = 1, limit = 25): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }> {
    const data = await this.request('/anime', {
      start_date: `${startYear}-01-01`,
      end_date: `${endYear}-12-31`,
      order_by: 'popularity',
      sort: 'asc',
      page,
      limit,
    });
    if (!data || !data.data) {
      return { items: [], pagination: { currentPage: page, lastVisiblePage: page, hasNextPage: false, totalItems: 0 } };
    }
    const items = data.data.map((item: any) => this.mapJikanAnime(item));
    const pag = data.pagination || {};
    return {
      items,
      pagination: {
        currentPage: pag.current_page || page,
        lastVisiblePage: pag.last_visible_page || page,
        hasNextPage: Boolean(pag.has_next_page),
        itemsCount: pag.items?.count,
        totalItems: pag.items?.total || 0,
      },
    };
  }

  async getAnimeEpisodes(externalId: string, page = 1): Promise<{ episodes: ProviderEpisode[]; pagination: ProviderPagination }> {
    const data = await this.request(`/anime/${externalId}/episodes`, { page });
    if (!data || !data.data) {
      return { episodes: [], pagination: { currentPage: page, lastVisiblePage: page, hasNextPage: false } };
    }

    const episodes: ProviderEpisode[] = data.data.map((ep: any) => ({
      externalId: String(ep.mal_id),
      number: ep.mal_id,
      title: ep.title,
      titleJapanese: ep.title_japanese || null,
      synopsis: ep.synopsis || null,
      airedAt: ep.aired || null,
      filler: Boolean(ep.filler),
      recap: Boolean(ep.recap),
      externalUrl: ep.url || null,
    }));

    const pag = data.pagination || {};
    return {
      episodes,
      pagination: {
        currentPage: pag.current_page || page,
        lastVisiblePage: pag.last_visible_page || page,
        hasNextPage: Boolean(pag.has_next_page),
      },
    };
  }

  async getAnimeCharacters(externalId: string): Promise<ProviderCharacter[]> {
    const data = await this.request(`/anime/${externalId}/characters`);
    if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
      return data.data.map((c: any) => ({
        externalId: String(c.character.mal_id),
        name: c.character.name,
        about: null,
        imageUrl: c.character.images?.webp?.image_url || c.character.images?.jpg?.image_url || null,
        role: c.role === 'Main' ? 'Main' : 'Supporting',
        voiceActors: Array.isArray(c.voice_actors)
          ? c.voice_actors.map((va: any) => ({
              personExternalId: String(va.person.mal_id),
              personName: va.person.name,
              personImage: va.person.images?.jpg?.image_url || null,
              language: va.language || 'Japanese',
            }))
          : [],
      }));
    }

    const fallback = await getJikanAnimeCharacters(Number(externalId));
    return fallback.map((c: any) => ({
      externalId: String(c.id),
      name: c.name,
      about: null,
      imageUrl: c.imageUrl,
      role: c.role || 'Main',
      voiceActors: (c.voiceActors || []).map((va: any) => ({
        personExternalId: String(va.id),
        personName: va.name,
        personImage: va.imageUrl,
        language: va.language || 'Japanese',
      })),
    }));
  }

  async getAnimeStaff(externalId: string): Promise<ProviderStaff[]> {
    const data = await this.request(`/anime/${externalId}/staff`);
    if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
      return data.data.map((s: any) => ({
        personExternalId: String(s.person.mal_id),
        personName: s.person.name,
        personImage: s.person.images?.jpg?.image_url || null,
        positions: Array.isArray(s.positions) ? s.positions : ['Staff'],
      }));
    }

    const fallback = await getJikanAnimeStaff(Number(externalId));
    return fallback.map((s: any) => ({
      personExternalId: String(s.id),
      personName: s.person?.name || 'Staff',
      personImage: s.person?.imageUrl || null,
      positions: [s.role || 'Staff'],
    }));
  }

  async getAnimeRelations(externalId: string): Promise<ProviderRelation[]> {
    const data = await this.request(`/anime/${externalId}/relations`);
    if (!data || !data.data) return [];

    const relations: ProviderRelation[] = [];
    data.data.forEach((r: any) => {
      const relType = r.relation;
      if (Array.isArray(r.entry)) {
        r.entry.forEach((entry: any) => {
          if (entry.type === 'anime') {
            relations.push({
              relationType: relType,
              relatedExternalId: String(entry.mal_id),
              relatedTitle: entry.name,
            });
          }
        });
      }
    });

    return relations;
  }

  async getAnimeVideos(externalId: string): Promise<ProviderVideo[]> {
    const data = await this.request(`/anime/${externalId}/videos`);
    if (!data || !data.data) return [];
    const list: ProviderVideo[] = [];
    if (Array.isArray(data.data.promo)) {
      data.data.promo.forEach((p: any) => {
        if (p.trailer?.url) {
          list.push({
            externalId: p.trailer.youtube_id || null,
            title: p.title || 'Trailer',
            type: 'TRAILER',
            url: p.trailer.url,
            thumbnailUrl: p.trailer.images?.medium_image_url || p.trailer.images?.large_image_url || null,
          });
        }
      });
    }
    return list;
  }

  async getAnimePictures(externalId: string) {
    const data = await this.request(`/anime/${externalId}/pictures`);
    if (!data || !data.data) return [];
    return data.data.map((pic: any) => ({
      imageUrl: pic.jpg?.image_url || pic.webp?.image_url || '',
      largeImageUrl: pic.jpg?.large_image_url || pic.webp?.large_image_url || null,
    })).filter((p: any) => Boolean(p.imageUrl));
  }

  async getAnimeNews(externalId: string) {
    const data = await this.request(`/anime/${externalId}/news`);
    if (!data || !data.data) return [];
    return data.data.map((item: any) => ({
      externalId: String(item.mal_id),
      title: item.title,
      url: item.url,
      date: item.date,
      authorUsername: item.author_username,
      authorUrl: item.author_url,
      forumUrl: item.forum_url,
      images: item.images,
      comments: item.comments,
      excerpt: item.excerpt,
    }));
  }

  async getAnimeRecommendations(externalId: string) {
    const data = await this.request(`/anime/${externalId}/recommendations`);
    if (!data || !data.data) return [];
    return data.data.map((item: any) => ({
      entry: {
        malId: item.entry?.mal_id,
        url: item.entry?.url,
        title: item.entry?.title,
        images: item.entry?.images,
      },
      votes: item.votes || 0,
    }));
  }

  async getAnimeReviews(externalId: string, page = 1) {
    const data = await this.request(`/anime/${externalId}/reviews`, { page });
    if (!data || !data.data) return [];
    return data.data.map((rev: any) => ({
      malId: rev.mal_id,
      url: rev.url,
      type: rev.type,
      votes: rev.votes || 0,
      date: rev.date,
      review: rev.review,
      score: rev.score || 0,
      tags: rev.tags,
      isSpoiler: Boolean(rev.is_spoiler),
      isPreliminary: Boolean(rev.is_preliminary),
      episodesWatched: rev.episodes_watched,
      user: {
        username: rev.user?.username || 'Observer',
        url: rev.user?.url || '',
        images: rev.user?.images,
      },
    }));
  }

  async getAnimeStreaming(externalId: string) {
    const data = await this.request(`/anime/${externalId}/streaming`);
    if (!data || !data.data) return [];
    return data.data.map((s: any) => ({
      name: s.name,
      url: s.url,
    }));
  }

  async getAnimeStatistics(externalId: string): Promise<ProviderStatistics | null> {
    const data = await this.request(`/anime/${externalId}/statistics`);
    if (!data || !data.data) return null;

    const st = data.data;
    const scores: Record<number, number> = {};
    if (Array.isArray(st.scores)) {
      st.scores.forEach((s: any) => {
        scores[s.score] = s.votes;
      });
    }

    return {
      watching: st.watching || 0,
      completed: st.completed || 0,
      onHold: st.on_hold || 0,
      dropped: st.dropped || 0,
      planToWatch: st.plan_to_watch || 0,
      total: st.total || 0,
      scores,
    };
  }
}

export const jikanProvider = new JikanProvider();

