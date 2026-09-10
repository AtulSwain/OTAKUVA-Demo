/**
 * OTAKUVA NEWS NORMALIZATION SERVICE (PHASE 8.4)
 * 
 * Production Normalization Pipeline:
 * - Unicode NFKC normalization & HTML entity unescaping
 * - Safe HTML sanitization (stripping XSS, script injection, unsafe tags)
 * - URL canonicalization (stripping UTM tracking parameters, hashes, trailing slashes)
 * - Source attribution standard mapping
 * - UTC timestamp normalization
 * - Category normalization mapping
 */

import { generateSlug } from '../../normalizers';
import { NewsCategory, NormalizedNewsArticle, RawNewsArticle } from './newsTypes';

const CATEGORY_MAP: Record<string, NewsCategory> = {
  // Anime & Production
  ANIME: 'ANIME',
  TV: 'ANIME',
  SERIES: 'ANIME',
  BROADCAST: 'ANIME',
  PRODUCTION: 'PRODUCTION',
  ANIMATION: 'PRODUCTION',
  STUDIOS: 'STUDIO',
  STUDIO: 'STUDIO',
  // Manga & Print
  MANGA: 'MANGA',
  LIGHT_NOVEL: 'MANGA',
  PRINT: 'MANGA',
  COMICS: 'MANGA',
  // People & Cast
  CASTING: 'CAST',
  CAST: 'CAST',
  VOICE_ACTOR: 'CAST',
  STAFF: 'STAFF',
  CREATORS: 'STAFF',
  DIRECTOR: 'STAFF',
  // Industry & Releases
  INDUSTRY: 'INDUSTRY',
  BUSINESS: 'INDUSTRY',
  RELEASE: 'RELEASE',
  PREMIERE: 'RELEASE',
  ANNOUNCEMENTS: 'ANNOUNCEMENT',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  TRAILERS: 'TRAILER',
  TRAILER: 'TRAILER',
  PV: 'TRAILER',
  TEASER: 'TRAILER',
  // Events & Misc
  EVENT: 'EVENT',
  EVENTS: 'EVENT',
  CONVENTION: 'EVENT',
  STREAMING: 'STREAMING',
  LICENSING: 'STREAMING',
  MERCHANDISE: 'MERCHANDISE',
  GOODS: 'MERCHANDISE',
  BOX_OFFICE: 'BOX_OFFICE',
  THEATRICAL: 'BOX_OFFICE',
  AWARDS: 'AWARDS',
  AWARD: 'AWARDS',
};

export class NewsNormalizationService {
  /**
   * Normalizes a raw incoming article from any provider into canonical OTAKUVA format
   */
  normalize(raw: RawNewsArticle, providerSlug: string): NormalizedNewsArticle {
    const title = this.normalizeTitle(raw.title);
    const normalizedTitle = this.createSearchableTitle(title);
    const slug = generateSlug(title);
    const summary = raw.summary ? this.sanitizeHtml(this.decodeHtmlEntities(raw.summary.trim())) : null;
    const content = raw.content ? this.sanitizeHtml(raw.content.trim()) : null;
    const sourceName = this.normalizeSourceName(raw.sourceName || raw.provider);
    const sourceUrl = this.normalizeUrl(raw.sourceUrl);
    const canonicalUrl = this.normalizeUrl(raw.canonicalUrl || raw.sourceUrl);
    const category = this.normalizeCategory(raw.category);
    const publishedAt = this.normalizeDate(raw.publishedAt);
    const language = (raw.language || 'en').toLowerCase().trim();

    return {
      externalId: raw.externalId.trim(),
      provider: (raw.provider || providerSlug).toUpperCase(),
      title,
      normalizedTitle,
      subtitle: raw.subtitle ? this.normalizeTitle(raw.subtitle) : null,
      slug,
      summary,
      content,
      contentType: raw.contentType || 'SOURCE_METADATA',
      sourceName,
      sourceUrl,
      canonicalUrl,
      imageUrl: raw.imageUrl?.trim() || null,
      author: raw.author ? this.normalizeAuthor(raw.author) : null,
      language,
      category,
      publishedAt,
      seasonContext: raw.seasonContext,
      episodeContext: raw.episodeContext,
    };
  }

  /**
   * Cleans title whitespace, unescapes HTML entities, and applies Unicode NFKC normalization
   */
  normalizeTitle(title: string): string {
    if (!title) return '';
    let decoded = this.decodeHtmlEntities(title);
    return decoded
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Creates a normalized, lowercase, diacritic-free string for matching & comparison
   */
  createSearchableTitle(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes canonical URLs by stripping tracking queries, enforcing secure protocols (http/https),
   * and rejecting unsafe schemes (javascript:, data:, file:, etc.)
   */
  normalizeUrl(url: string): string {
    if (!url || typeof url !== 'string') return '';
    try {
      const parsed = new URL(url.trim());
      // Disallow non-web protocols
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }

      // Strip tracking query parameters
      const trackingParams = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'ref',
        'fbclid',
        'gclid',
        'source',
      ];
      trackingParams.forEach((param) => parsed.searchParams.delete(param));

      // Lowercase hostname & strip trailing slash if not root
      let cleanUrl = `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname}`;
      if (cleanUrl.endsWith('/') && parsed.pathname !== '/') {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      if (parsed.search) {
        cleanUrl += parsed.search;
      }
      return cleanUrl;
    } catch {
      // If parsing fails or protocol is invalid, reject
      return '';
    }
  }

  /**
   * Maps external category strings to canonical OTAKUVA NewsCategory
   */
  normalizeCategory(category?: string): NewsCategory {
    if (!category) return 'ANIME';
    const clean = category.trim().toUpperCase().replace(/[-\s]+/g, '_');
    return CATEGORY_MAP[clean] || 'ANIME';
  }

  /**
   * Normalizes source publisher name
   */
  normalizeSourceName(sourceName: string): string {
    const clean = sourceName.trim();
    if (/^ann$/i.test(clean) || /anime\s*news\s*network/i.test(clean)) {
      return 'Anime News Network';
    }
    if (/crunchyroll/i.test(clean)) {
      return 'Crunchyroll News';
    }
    return clean;
  }

  /**
   * Normalizes timestamps into strict UTC Date objects
   */
  normalizeDate(dateInput: Date | string | number): Date {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  }

  /**
   * Cleans and formats author names
   */
  normalizeAuthor(author: string): string {
    return this.decodeHtmlEntities(author)
      .replace(/\s+/g, ' ')
      .replace(/^(by|author:)\s+/i, '')
      .trim();
  }

  /**
   * Decodes common HTML entities
   */
  decodeHtmlEntities(str: string): string {
    return str
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#8217;/g, '’')
      .replace(/&#8216;/g, '‘')
      .replace(/&#8220;/g, '“')
      .replace(/&#8221;/g, '”')
      .replace(/&#8212;/g, '—')
      .replace(/&#8211;/g, '–');
  }

  /**
   * Sanitizes HTML to prevent XSS and malicious script execution
   */
  sanitizeHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '') // strip on* handlers (onload, onerror)
      .replace(/javascript\s*:/gi, 'blocked:');
  }
}

export const newsNormalizationService = new NewsNormalizationService();
