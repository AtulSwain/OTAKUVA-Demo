/**
 * ANIME HERALD REAL-WORLD PROVIDER ADAPTER
 * Ingests real anime news from Anime Herald's RSS feed.
 */

import { GenericRssNewsAdapter } from './genericRssAdapter';

export class AnimeHeraldNewsAdapter extends GenericRssNewsAdapter {
  public readonly id = 'anime_herald';
  public readonly name = 'Anime Herald';
  public readonly baseUrl = 'https://animeherald.com';
  protected readonly idPrefix = 'aherald';
  protected readonly providerCode = 'ANIME_HERALD';
  protected readonly defaultAuthor = 'Anime Herald Staff';

  protected getFeedUrl(): string {
    return process.env.ANIME_HERALD_FEED_URL || 'https://animeherald.com/feed/';
  }
}

export const animeHeraldNewsAdapter = new AnimeHeraldNewsAdapter();
