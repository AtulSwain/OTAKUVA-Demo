/**
 * MOCK MULTI-PROVIDER ADAPTER FOR TESTING & SYNDICATION CLUSTERING
 */

import { NewsProviderAdapter } from '../newsProvider.interface';
import { ProviderHealthStatus, RawNewsArticle } from '../newsTypes';

export interface MockAdapterOptions {
  id?: string;
  name?: string;
  baseUrl?: string;
  articles?: RawNewsArticle[];
  shouldFail?: boolean;
}

export class MockProviderAdapter implements NewsProviderAdapter {
  public id: string;
  public name: string;
  public baseUrl: string;
  public articles: RawNewsArticle[] = [];
  public shouldFail: boolean = false;

  constructor(
    optionsOrId: MockAdapterOptions | string = 'mock_provider_b',
    name = 'Anime Global Bulletin',
    baseUrl = 'https://globalbulletin.mock'
  ) {
    if (typeof optionsOrId === 'object' && optionsOrId !== null) {
      this.id = optionsOrId.id || 'mock_provider_b';
      this.name = optionsOrId.name || 'Anime Global Bulletin';
      this.baseUrl = optionsOrId.baseUrl || 'https://globalbulletin.mock';
      this.shouldFail = optionsOrId.shouldFail || false;
      if (optionsOrId.articles) {
        this.articles = optionsOrId.articles;
      }
    } else {
      this.id = optionsOrId;
      this.name = name;
      this.baseUrl = baseUrl;
    }

    if (this.articles.length === 0) {
      this.articles = [
        {
          externalId: `${this.id}-syndicated-frieren-s2`,
          provider: this.id.toUpperCase(),
          title: "Madhouse Greenlights Frieren: Beyond Journey's End Second Season",
          summary: 'Global announcement for Frieren Season 2 with the original creative team returning.',
          contentType: 'SOURCE_METADATA',
          sourceName: this.name,
          sourceUrl: `${this.baseUrl}/articles/frieren-s2`,
          canonicalUrl: `${this.baseUrl}/articles/frieren-s2`,
          publishedAt: new Date(),
          category: 'PRODUCTION',
          mentionedAnimeTitles: ["Frieren: Beyond Journey's End"],
          mentionedStudioNames: ['Madhouse'],
        },
      ];
    }
  }

  setArticles(articles: RawNewsArticle[]) {
    this.articles = articles;
  }

  async fetchLatest(limit = 10): Promise<RawNewsArticle[]> {
    if (this.shouldFail) {
      throw new Error(`Provider ${this.name} API connection timed out (Simulated)`);
    }
    return this.articles.slice(0, limit);
  }

  async fetchByDate(startDate: Date, endDate: Date = new Date()): Promise<RawNewsArticle[]> {
    if (this.shouldFail) throw new Error('Simulated failure');
    return this.articles.filter((a) => a.publishedAt >= startDate && a.publishedAt <= endDate);
  }

  async fetchById(externalId: string): Promise<RawNewsArticle | null> {
    if (this.shouldFail) throw new Error('Simulated failure');
    return this.articles.find((a) => a.externalId === externalId) || null;
  }

  async search(query: string, limit = 10): Promise<RawNewsArticle[]> {
    if (this.shouldFail) throw new Error('Simulated failure');
    return this.articles.filter((a) => a.title.toLowerCase().includes(query.toLowerCase())).slice(0, limit);
  }

  async healthCheck(): Promise<{ status: ProviderHealthStatus; latencyMs: number; error?: string }> {
    if (this.shouldFail) {
      return { status: 'FAILED', latencyMs: 50, error: 'Simulated connection failure' };
    }
    return { status: 'HEALTHY', latencyMs: 15 };
  }
}
