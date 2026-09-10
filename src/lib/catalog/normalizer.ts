/**
 * OTAKUVA ANIME CATALOG & DATA INGESTION ENGINE — PHASE 13
 * CATALOG DATA NORMALIZER & TAXONOMY ENGINE (13.6 → 13.12 & 13.26 → 13.28)
 * 
 * Normalizes multi-source data into canonical OTAKUVA models:
 * - Multi-language title normalization & search key indexing
 * - Anime format & status categorization
 * - Seasonal & temporal mapping
 * - Canonical Genre, Theme & Demographic taxonomies
 */

import { ProviderAnime } from '../providers/animeProvider.interface';
import { normalizeSlug, normalizeSearchTitle, sanitizePublicEntityName } from '../normalizers';

export type AnimeFormat = 'TV' | 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL' | 'MUSIC' | 'OTHER';
export type AiringStatus = 'FINISHED' | 'AIRING' | 'NOT_YET_AIRED' | 'CANCELLED';
export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export interface NormalizedAnimePayload {
  externalId: string;
  externalSource: string;
  malId?: number | null;
  anilistId?: number | null;
  slug: string;
  canonicalTitle: string;
  searchKey: string;
  synopsis: string;
  type: AnimeFormat;
  status: AiringStatus;
  season?: AnimeSeason | null;
  year?: number | null;
  episodes?: number | null;
  duration?: string | null;
  score?: number | null;
  posterUrl: string;
  largePosterUrl?: string | null;
  bannerUrl?: string | null;
  trailerUrl?: string | null;
  titles: { type: string; title: string; language?: string }[];
  genres: string[];
  themes: string[];
  demographics: string[];
  studios: { name: string; isMain?: boolean }[];
  producers: string[];
}

export class CatalogNormalizer {
  /**
   * Normalizes anime formats to canonical enum
   */
  static normalizeFormat(rawType?: string | null): AnimeFormat {
    if (!rawType) return 'TV';
    const upper = rawType.toUpperCase().trim();
    if (upper.includes('MOVIE') || upper.includes('FILM')) return 'MOVIE';
    if (upper.includes('OVA')) return 'OVA';
    if (upper.includes('ONA') || upper.includes('WEB')) return 'ONA';
    if (upper.includes('SPECIAL') || upper.includes('TV_SPECIAL')) return 'SPECIAL';
    if (upper.includes('MUSIC')) return 'MUSIC';
    if (upper.includes('TV')) return 'TV';
    return 'OTHER';
  }

  /**
   * Normalizes airing status to canonical enum
   */
  static normalizeStatus(rawStatus?: string | null): AiringStatus {
    if (!rawStatus) return 'FINISHED';
    const upper = rawStatus.toUpperCase().trim();
    if (upper.includes('FINISHED') || upper.includes('COMPLETED')) return 'FINISHED';
    if (upper.includes('NOT') || upper.includes('UPCOMING') || upper.includes('YET')) return 'NOT_YET_AIRED';
    if (upper.includes('CANCEL')) return 'CANCELLED';
    if (upper.includes('AIRING') || upper.includes('RELEASING') || upper.includes('CURRENT')) return 'AIRING';
    return 'FINISHED';
  }

  /**
   * Normalizes seasons to canonical 4-season taxonomy
   */
  static normalizeSeason(rawSeason?: string | null): AnimeSeason | null {
    if (!rawSeason) return null;
    const upper = rawSeason.toUpperCase().trim();
    if (upper.includes('WINTER')) return 'WINTER';
    if (upper.includes('SPRING')) return 'SPRING';
    if (upper.includes('SUMMER')) return 'SUMMER';
    if (upper.includes('FALL') || upper.includes('AUTUMN')) return 'FALL';
    return null;
  }

  /**
   * Generates strict search normalization key
   */
  static generateSearchKey(title: string): string {
    return normalizeSearchTitle(title);
  }

  /**
   * Transforms raw provider anime into canonical normalized model
   */
  static normalize(raw: ProviderAnime): NormalizedAnimePayload {
    if (!raw.title || !raw.title.trim() || !raw.externalId || !String(raw.externalId).trim()) {
      throw new Error('Anime missing required externalId or title');
    }
    const rawClean = raw.title.trim();
    const canonicalTitle = sanitizePublicEntityName(rawClean) || rawClean;
    const slug = normalizeSlug(canonicalTitle, raw.externalId);
    const searchKey = this.generateSearchKey(canonicalTitle);
    const type = this.normalizeFormat(raw.type);
    const status = this.normalizeStatus(raw.status);
    const season = this.normalizeSeason(raw.season);
    const year = raw.year || raw.startDate?.year || null;

    // Build comprehensive multi-title dictionary
    const titles: { type: string; title: string; language?: string }[] = [];
    titles.push({ type: 'official', title: canonicalTitle, language: 'en' });

    if (raw.titles && Array.isArray(raw.titles)) {
      for (const t of raw.titles) {
        const cleanT = sanitizePublicEntityName(t.title?.trim() || '');
        if (cleanT && !titles.some((existing) => existing.title.toLowerCase() === cleanT.toLowerCase())) {
          titles.push({
            type: t.type || 'synonym',
            title: cleanT,
            language: t.language || undefined,
          });
        }
      }
    }

    // Standardize Genre Taxonomy
    const canonicalGenres = Array.from(
      new Set(
        (raw.genres || [])
          .map((g) => g.trim())
          .filter((g) => g.length > 0)
      )
    );

    // Standardize Theme Taxonomy
    const canonicalThemes = Array.from(
      new Set(
        (raw.themes || [])
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      )
    );

    // Standardize Studio Names
    const cleanStudios = (Array.isArray(raw.studios) ? raw.studios : [])
      .map((s) => ({
        name: sanitizePublicEntityName(typeof s === 'string' ? s : s.name),
        isMain: typeof s === 'object' ? s.isMain : true,
      }))
      .filter((s) => s.name.length > 0);

    return {
      externalId: String(raw.externalId),
      externalSource: raw.externalSource || 'anilist',
      malId: raw.malId || null,
      anilistId: raw.anilistId || (raw.externalSource === 'anilist' ? parseInt(raw.externalId, 10) : null),
      slug,
      canonicalTitle,
      searchKey,
      synopsis: raw.synopsis ? raw.synopsis.trim() : 'No synopsis available.',
      type,
      status,
      season,
      year,
      episodes: typeof raw.episodes === 'number' && raw.episodes > 0 ? Math.floor(raw.episodes) : null,
      duration: raw.duration || '24 min',
      score: typeof raw.score === 'number' && raw.score >= 0 && raw.score <= 10 ? raw.score : null,
      posterUrl: raw.posterUrl || 'https://otakuva.com/placeholder-poster.jpg',
      largePosterUrl: raw.largePosterUrl || raw.posterUrl || null,
      bannerUrl: raw.bannerUrl || null,
      trailerUrl: raw.trailerUrl || null,
      titles,
      genres: canonicalGenres,
      themes: canonicalThemes,
      demographics: [],
      studios: cleanStudios,
      producers: Array.isArray(raw.producers) ? raw.producers : [],
    };
  }
}
