/**
 * ANIME CORNER REAL-WORLD PROVIDER ADAPTER
 * Ingests real anime news from Anime Corner's RSS feed.
 */

import { GenericRssNewsAdapter } from './genericRssAdapter';

export class AnimeCornerNewsAdapter extends GenericRssNewsAdapter {
  public readonly id = 'anime_corner';
  public readonly name = 'Anime Corner';
  public readonly baseUrl = 'https://animecorner.me';
  protected readonly idPrefix = 'acorner';
  protected readonly providerCode = 'ANIME_CORNER';
  protected readonly defaultAuthor = 'Anime Corner Staff';

  protected getFeedUrl(): string {
    return process.env.ANIME_CORNER_FEED_URL || 'https://animecorner.me/feed/';
  }
}

export const animeCornerNewsAdapter = new AnimeCornerNewsAdapter();
