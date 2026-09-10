/**
 * MYANIMELIST NEWS REAL-WORLD PROVIDER ADAPTER
 * Ingests real anime news from MAL's official news RSS feed.
 */

import { GenericRssNewsAdapter } from './genericRssAdapter';

export class MyAnimeListNewsAdapter extends GenericRssNewsAdapter {
  public readonly id = 'myanimelist';
  public readonly name = 'MyAnimeList News';
  public readonly baseUrl = 'https://myanimelist.net/news';
  protected readonly idPrefix = 'mal';
  protected readonly providerCode = 'MYANIMELIST';
  protected readonly defaultAuthor = 'MyAnimeList News Staff';

  protected getFeedUrl(): string {
    return process.env.MAL_NEWS_FEED_URL || 'https://myanimelist.net/rss/news.xml';
  }
}

export const myAnimeListNewsAdapter = new MyAnimeListNewsAdapter();
