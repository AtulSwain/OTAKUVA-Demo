/**
 * OTAKUVA ANIME CATALOG & DATA INGESTION ENGINE — PHASE 13
 * PROVIDER-AGNOSTIC ADAPTER ARCHITECTURE (13.4 & 13.5)
 * 
 * Provider-agnostic abstraction supporting multi-source catalog ingestion:
 * - Decouples OTAKUVA from specific external APIs
 * - Resilient HTTP fetcher with rate limiting and exponential backoff
 * - Normalized provider response contract
 */

import { ProviderAnime, ProviderEpisode, ProviderCharacter, ProviderStaff, ProviderRelation, ProviderPagination } from '../providers/animeProvider.interface';
import { anilistProvider, jikanProvider } from '../providers';

export interface CatalogProviderAdapter {
  providerName: string;
  fetchAnimeDetails(externalId: string): Promise<ProviderAnime | null>;
  searchAnime(query: string, page?: number, limit?: number): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }>;
  fetchAnimeList(page?: number, limit?: number): Promise<{ items: ProviderAnime[]; pagination: ProviderPagination }>;
  fetchEpisodes(externalId: string, page?: number): Promise<{ episodes: ProviderEpisode[]; pagination: ProviderPagination }>;
  fetchCharacters(externalId: string): Promise<ProviderCharacter[]>;
  fetchStaff(externalId: string): Promise<ProviderStaff[]>;
  fetchRelations(externalId: string): Promise<ProviderRelation[]>;
}

export class ProviderRegistry {
  private static providers = new Map<string, CatalogProviderAdapter>();

  static registerProvider(adapter: CatalogProviderAdapter) {
    this.providers.set(adapter.providerName.toLowerCase(), adapter);
  }

  static getProvider(name: string): CatalogProviderAdapter {
    const key = name.toLowerCase();
    const provider = this.providers.get(key);
    if (!provider) {
      // Fallback default to AniList adapter
      return this.providers.get('anilist') || defaultAniListAdapter;
    }
    return provider;
  }

  static listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// AniList Provider Adapter Implementation
export const defaultAniListAdapter: CatalogProviderAdapter = {
  providerName: 'anilist',
  fetchAnimeDetails: async (id: string) => anilistProvider.getAnime(id),
  searchAnime: async (q: string, p = 1, l = 20) => anilistProvider.searchAnime(q, p, l),
  fetchAnimeList: async (p = 1, l = 25) => anilistProvider.getAnimeList(p, l),
  fetchEpisodes: async (id: string, p = 1) => anilistProvider.getAnimeEpisodes(id, p),
  fetchCharacters: async (id: string) => anilistProvider.getAnimeCharacters(id),
  fetchStaff: async (id: string) => anilistProvider.getAnimeStaff(id),
  fetchRelations: async (id: string) => anilistProvider.getAnimeRelations(id),
};

// Jikan / MAL Provider Adapter Implementation
export const defaultJikanAdapter: CatalogProviderAdapter = {
  providerName: 'jikan',
  fetchAnimeDetails: async (id: string) => jikanProvider.getAnime(id),
  searchAnime: async (q: string, p = 1, l = 20) => jikanProvider.searchAnime(q, p, l),
  fetchAnimeList: async (p = 1, l = 25) => jikanProvider.getAnimeList(p, l),
  fetchEpisodes: async (id: string, p = 1) => jikanProvider.getAnimeEpisodes(id, p),
  fetchCharacters: async (id: string) => jikanProvider.getAnimeCharacters(id),
  fetchStaff: async (id: string) => jikanProvider.getAnimeStaff(id),
  fetchRelations: async (id: string) => jikanProvider.getAnimeRelations(id),
};

// Auto-register built-in adapters
ProviderRegistry.registerProvider(defaultAniListAdapter);
ProviderRegistry.registerProvider(defaultJikanAdapter);
