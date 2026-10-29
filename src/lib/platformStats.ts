/**
 * Real platform counts for page mastheads (Explore, …). Cached for ten
 * minutes — they're "about" numbers, not live counters. Zero counts are left
 * to the UI to hide.
 */
import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';

export interface PlatformStats {
  anime: number;
  people: number;
  members: number;
  articles: number;
  reviews: number;
}

async function buildPlatformStats(): Promise<PlatformStats> {
  const [anime, people, members, articles, reviews] = await Promise.all([
    prisma.anime.count({ where: { status: { not: 'MERGED' }, isAdult: false } }),
    prisma.person.count(),
    prisma.user.count(),
    prisma.userArticle.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    prisma.review.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
  ]);
  return { anime, people, members, articles, reviews };
}

export const getPlatformStats = unstable_cache(buildPlatformStats, ['platform-stats'], { revalidate: 600, tags: ['platform-stats'] });
