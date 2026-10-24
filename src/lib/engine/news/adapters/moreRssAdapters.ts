/**
 * ADDITIONAL REAL-WORLD NEWS SOURCES (RSS)
 *
 * Each feed below was probed live before being added (HTTP 200, valid RSS,
 * items dated within the last few weeks). Same shared parsing as
 * Anime Herald / Anime Corner — see genericRssAdapter.ts.
 */

import { GenericRssNewsAdapter } from './genericRssAdapter';

export class AnimeUkNewsAdapter extends GenericRssNewsAdapter {
  public readonly id = 'anime_uk_news';
  public readonly name = 'Anime UK News';
  public readonly baseUrl = 'https://animeuknews.net';
  protected readonly idPrefix = 'aukn';
  protected readonly providerCode = 'ANIME_UK_NEWS';
  protected readonly defaultAuthor = 'Anime UK News';

  protected getFeedUrl(): string {
    return process.env.ANIME_UK_NEWS_FEED_URL || 'https://www.animeuknews.net/feed';
  }
}

export class AnimeFeministNewsAdapter extends GenericRssNewsAdapter {
  public readonly id = 'anime_feminist';
  public readonly name = 'Anime Feminist';
  public readonly baseUrl = 'https://www.animefeminist.com';
  protected readonly idPrefix = 'afem';
  protected readonly providerCode = 'ANIME_FEMINIST';
  protected readonly defaultAuthor = 'Anime Feminist';

  protected getFeedUrl(): string {
    return process.env.ANIME_FEMINIST_FEED_URL || 'https://www.animefeminist.com/feed/';
  }
}

export class HoneysAnimeNewsAdapter extends GenericRssNewsAdapter {
  public readonly id = 'honeys_anime';
  public readonly name = "Honey's Anime";
  public readonly baseUrl = 'https://www.honeysanime.com';
  protected readonly idPrefix = 'honey';
  protected readonly providerCode = 'HONEYS_ANIME';
  protected readonly defaultAuthor = "Honey's Anime";

  protected getFeedUrl(): string {
    return process.env.HONEYS_ANIME_FEED_URL || 'https://www.honeysanime.com/feed/';
  }
}

export const animeUkNewsAdapter = new AnimeUkNewsAdapter();
export const animeFeministNewsAdapter = new AnimeFeministNewsAdapter();
export const honeysAnimeNewsAdapter = new HoneysAnimeNewsAdapter();
