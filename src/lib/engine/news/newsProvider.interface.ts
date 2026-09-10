/**
 * OTAKUVA NEWS PROVIDER ABSTRACTION INTERFACE
 * Strict provider-independent contract.
 */

import { ProviderHealthStatus, RawNewsArticle } from './newsTypes';

export interface NewsProviderAdapter {
  /**
   * Unique identifier/slug for the provider (e.g. "ann", "official_press", "mock_provider")
   */
  readonly id: string;

  /**
   * Human-readable display name
   */
  readonly name: string;

  /**
   * Base URL for the provider's source
   */
  readonly baseUrl: string;

  /**
   * Fetches latest articles from the provider feed
   */
  fetchLatest(limit?: number): Promise<RawNewsArticle[]>;

  /**
   * Fetches articles within a specific date range
   */
  fetchByDate(startDate: Date, endDate?: Date): Promise<RawNewsArticle[]>;

  /**
   * Fetches a specific article by its external ID
   */
  fetchById(externalId: string): Promise<RawNewsArticle | null>;

  /**
   * Searches the provider for articles matching a query
   */
  search(query: string, limit?: number): Promise<RawNewsArticle[]>;

  /**
   * Performs an active health check on the provider endpoint
   */
  healthCheck(): Promise<{
    status: ProviderHealthStatus;
    latencyMs: number;
    error?: string;
  }>;
}
