export interface ProviderNewsArticle {
  externalId: string;
  title: string;
  slug: string;
  summary: string | null;
  sourceName: string;
  sourceUrl: string;
  canonicalUrl?: string | null;
  imageUrl?: string | null;
  author?: string | null;
  category: 'ANIME' | 'MANGA' | 'STUDIOS' | 'INDUSTRY' | 'ANNOUNCEMENTS' | 'CASTING' | 'PRODUCTION' | 'TRAILERS';
  publishedAt: Date;
  tags?: string[];
  mentionedAnimeTitles?: string[];
  mentionedStudioNames?: string[];
  mentionedPeopleNames?: string[];
}

export interface NewsProvider {
  name: string;
  fetchLatest(limit?: number): Promise<ProviderNewsArticle[]>;
  fetchByCategory(category: string, limit?: number): Promise<ProviderNewsArticle[]>;
  searchNews(query: string, limit?: number): Promise<ProviderNewsArticle[]>;
}
