/**
 * OTAKUVA — MEDIA ASSET & IMAGE HEALTH SCANNER AND REPAIR SERVICE
 * 
 * Features:
 * - Scans canonical Anime, Studio, Creator, and News records for valid image URLs
 * - Checks format, length, protocol, and absence of malformed tokens ('undefined', 'null', 'nan', etc.)
 * - Deterministic fallback image generator for zero broken UI image assets
 * - Health metrics reporting & batch repair queue
 */

import { prisma } from '../../prisma';
import { anilistProvider, jikanProvider } from '../../providers';

export interface ImageHealthMetrics {
  totalScanned: number;
  validCount: number;
  invalidCount: number;
  missingCount: number;
  repairedCount: number;
  lastScanAt: string | null;
  brokenAssets: Array<{
    id: string;
    type: 'ANIME' | 'STUDIO' | 'CREATOR' | 'NEWS';
    title: string;
    url: string | null;
    reason: string;
  }>;
}

const BAD_URL_PATTERN = /\b(undefined|null|nan|placeholder|demo)\b/i;

export function isCleanImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length < 10) return false;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) return false;
  if (BAD_URL_PATTERN.test(trimmed)) return false;
  return true;
}

export class ImageHealthService {
  private static metrics: ImageHealthMetrics = {
    totalScanned: 0,
    validCount: 0,
    invalidCount: 0,
    missingCount: 0,
    repairedCount: 0,
    lastScanAt: null,
    brokenAssets: [],
  };

  static async scanCatalogImages(): Promise<ImageHealthMetrics> {
    const animes = await prisma.anime.findMany({
      select: { id: true, canonicalTitle: true, posterUrl: true, bannerUrl: true },
      take: 200,
    });

    let valid = 0;
    let invalid = 0;
    let missing = 0;
    const broken: ImageHealthMetrics['brokenAssets'] = [];

    for (const anime of animes) {
      if (!anime.posterUrl) {
        missing++;
        broken.push({
          id: anime.id,
          type: 'ANIME',
          title: anime.canonicalTitle,
          url: null,
          reason: 'Missing poster URL',
        });
      } else if (!isCleanImageUrl(anime.posterUrl)) {
        invalid++;
        broken.push({
          id: anime.id,
          type: 'ANIME',
          title: anime.canonicalTitle,
          url: anime.posterUrl,
          reason: 'Malformed or invalid URL',
        });
      } else {
        valid++;
      }
    }

    this.metrics = {
      totalScanned: animes.length,
      validCount: valid,
      invalidCount: invalid,
      missingCount: missing,
      repairedCount: this.metrics.repairedCount,
      lastScanAt: new Date().toISOString(),
      brokenAssets: broken.slice(0, 20),
    };

    return { ...this.metrics };
  }

  /**
   * Re-fetches the real poster for anime whose stored poster is empty or a
   * stringified "undefined"/"null", from the provider the record came from
   * (AniList ids go to AniList, MAL ids to Jikan — never the failover wrapper,
   * which would hand an id to the other provider's id space).
   *
   * This used to overwrite those posters with a stock Unsplash photo and
   * count it as "repaired" — invented artwork stored as canonical data. A
   * poster the provider can't supply now stays missing (the UI shows its
   * placeholder) and is counted as failed, so it can be retried later.
   */
  static async repairCatalogImages(): Promise<{ repaired: number; failed: number }> {
    let repaired = 0;
    let failed = 0;

    const brokenAnimes = await prisma.anime.findMany({
      where: {
        OR: [
          { posterUrl: '' },
          { posterUrl: { contains: 'undefined' } },
          { posterUrl: { contains: 'null' } },
        ],
      },
      select: { id: true, externalId: true, externalSource: true, malId: true, anilistId: true },
      take: 50,
    });

    for (const anime of brokenAnimes) {
      try {
        const lookup =
          anime.anilistId != null
            ? { provider: anilistProvider, id: String(anime.anilistId) }
            : anime.malId != null
            ? { provider: jikanProvider, id: String(anime.malId) }
            : anime.externalId
            ? { provider: anime.externalSource === 'mal' || anime.externalSource === 'jikan' ? jikanProvider : anilistProvider, id: anime.externalId }
            : null;
        if (!lookup) {
          failed++;
          continue;
        }
        const fresh = await lookup.provider.getAnime(lookup.id);
        const poster = fresh?.largePosterUrl || fresh?.posterUrl;
        if (!poster || !/^https?:\/\//.test(poster)) {
          failed++;
          continue;
        }
        await prisma.anime.update({
          where: { id: anime.id },
          data: { posterUrl: poster, ...(fresh?.largePosterUrl ? { largePosterUrl: fresh.largePosterUrl } : {}) },
        });
        repaired++;
      } catch (e) {
        failed++;
      }
    }

    this.metrics.repairedCount += repaired;
    return { repaired, failed };
  }

  static getHealthSummary(): ImageHealthMetrics {
    return { ...this.metrics };
  }
}
