/**
 * OTAKUVA QUALITY ENGINEERING — PHASE 11.1
 * DETERMINISTIC TEST FACTORIES & FIXTURES
 * 
 * Provides deterministic, isolated entity creation for all testing stages:
 * - UserFactory
 * - AnimeFactory
 * - StudioFactory
 * - EpisodeFactory
 * - RatingFactory
 * - ReviewFactory
 * - CommunityFactory
 * - NewsFactory
 */

import { prisma } from '../prisma';
import { hashPassword } from '../auth';

export class UserFactory {
  static async create(overrides: Partial<{ username: string; email: string; role: string }> = {}) {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const hashedPassword = await hashPassword('OtakuvaTestPass123!');
    return prisma.user.create({
      data: {
        username: overrides.username || `testuser_${uniqueId}`,
        email: overrides.email || `testuser_${uniqueId}@otakuva.test`,
        passwordHash: hashedPassword,
        role: overrides.role || 'USER',
      },
    });
  }
}

export class StudioFactory {
  static async create(overrides: Partial<{ name: string; slug: string; status: string }> = {}) {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return prisma.studio.create({
      data: {
        name: overrides.name || `Studio Test ${uniqueId}`,
        slug: overrides.slug || `studio-test-${uniqueId}`,
        status: overrides.status || 'ACTIVE',
      },
    });
  }
}

export class AnimeFactory {
  static async create(overrides: Partial<{
    canonicalTitle: string;
    slug: string;
    synopsis: string;
    posterUrl: string;
    format: string;
    episodesCount: number;
    score: number;
    studioId: string;
    genres: string[];
  }> = {}) {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = overrides.canonicalTitle || `Anime Test ${uniqueId}`;
    const slug = overrides.slug || `anime-test-${uniqueId}`;

    const anime = await prisma.anime.create({
      data: {
        canonicalTitle: title,
        slug,
        synopsis: overrides.synopsis || 'An exciting adventure of deep narrative complexity.',
        posterUrl: overrides.posterUrl || 'https://otakuva.test/images/poster.jpg',
        type: overrides.format || 'TV',
        episodes: overrides.episodesCount || 12,
        score: overrides.score || 8.0,
      },
    });

    if (overrides.studioId) {
      await prisma.animeStudio.create({
        data: {
          animeId: anime.id,
          studioId: overrides.studioId,
          role: 'MAIN_STUDIO',
        },
      });
    }

    if (overrides.genres && overrides.genres.length > 0) {
      for (const genreName of overrides.genres) {
        const genre = await prisma.genre.upsert({
          where: { name: genreName },
          update: {},
          create: { name: genreName, slug: genreName.toLowerCase().replace(/\s+/g, '-') },
        });
        await prisma.animeGenre.create({
          data: { animeId: anime.id, genreId: genre.id },
        });
      }
    }

    return anime;
  }
}

export class EpisodeFactory {
  static async create(animeId: string, episodeNumber = 1, title?: string) {
    return prisma.episode.create({
      data: {
        animeId,
        number: episodeNumber,
        title: title || `Episode ${episodeNumber}`,
      },
    });
  }
}

export class RatingFactory {
  static async create(userId: string, animeId: string, rating = 8.5) {
    return prisma.animeRating.upsert({
      where: { userId_animeId: { userId, animeId } },
      update: { rating },
      create: { userId, animeId, rating },
    });
  }
}

export class ReviewFactory {
  static async create(userId: string, animeId: string, body = 'Outstanding production and compelling characters.', rating = 9) {
    return prisma.review.create({
      data: {
        userId,
        animeId,
        title: 'Masterpiece Review',
        body,
        rating: Math.round(rating),
      },
    });
  }
}

export class CommunityFactory {
  static async create(ownerId: string, overrides: Partial<{ name: string; slug: string; isPrivate: boolean; animeId?: string }> = {}) {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const comm = await prisma.community.create({
      data: {
        name: overrides.name || `Community ${uniqueId}`,
        slug: overrides.slug || `comm-${uniqueId}`,
        ownerId,
        visibility: overrides.isPrivate ? 'PRIVATE' : 'PUBLIC',
        description: 'A vibrant anime discussion community.',
        animeId: overrides.animeId || null,
      },
    });

    // Auto-join owner as OWNER
    await prisma.communityMember.create({
      data: {
        communityId: comm.id,
        userId: ownerId,
        role: 'OWNER',
      },
    });

    return comm;
  }
}

export class NewsFactory {
  static async create(overrides: Partial<{ title: string; slug: string; sourceName: string; sourceUrl: string; animeId?: string }> = {}) {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const article = await prisma.newsArticle.create({
      data: {
        title: overrides.title || `Anime News Update ${uniqueId}`,
        slug: overrides.slug || `news-update-${uniqueId}`,
        content: 'Comprehensive report on seasonal production updates and announcements.',
        sourceName: overrides.sourceName || 'OTAKUVA Editorial',
        sourceUrl: overrides.sourceUrl || `https://otakuva.test/news/news-update-${uniqueId}`,
        publishedAt: new Date(),
        status: 'PUBLISHED',
      },
    });

    if (overrides.animeId) {
      await prisma.newsArticleAnime.create({
        data: {
          articleId: article.id,
          animeId: overrides.animeId,
          relationType: 'PRIMARY_SUBJECT',
        },
      });
    }

    return article;
  }
}
