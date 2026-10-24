import { NewsProvider, ProviderNewsArticle } from './newsProvider.interface';

export class AnnNewsProvider implements NewsProvider {
  public name = 'ANN';
  private baseUrl = 'https://www.animenewsnetwork.com';

  /**
   * Fetches latest verified anime news
   */
  /**
   * Legacy and unused: the live news pipeline is src/lib/engine/news
   * (real RSS adapters). This method used to return a hardcoded list of
   * invented "Anime News Network" stories — made-up headlines, a real ANN
   * writer's name as author, and fabricated ANN URLs — presented as a
   * "curated industry feed" fallback. None of it ever reached the database,
   * but one call would have ingested it, so it now fails loudly instead.
   */
  async fetchLatest(_limit = 20): Promise<ProviderNewsArticle[]> {
    throw new Error(
      'annNewsProvider (src/lib/news) is retired and returns no data. Use the news engine adapters in src/lib/engine/news/adapters.'
    );
  }

  async fetchByCategory(category: string, limit = 20): Promise<ProviderNewsArticle[]> {
    const all = await this.fetchLatest(limit * 2);
    return all.filter((a) => a.category.toUpperCase() === category.toUpperCase()).slice(0, limit);
  }

  async searchNews(query: string, limit = 20): Promise<ProviderNewsArticle[]> {
    const all = await this.fetchLatest(limit * 2);
    const q = query.toLowerCase();
    return all.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.mentionedAnimeTitles?.some((t) => t.toLowerCase().includes(q))
    ).slice(0, limit);
  }
}

export const annNewsProvider = new AnnNewsProvider();
