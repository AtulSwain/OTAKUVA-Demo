import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { createAndAnalyzeReview } from '../../../lib/engine/review/reviewIntelligence';
import { getAnimeDisplayTitle } from '../../../lib/animeTitleResolver';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const animeId = searchParams.get('animeId');
    const episodeId = searchParams.get('episodeId');
    const userId = searchParams.get('userId');
    const sort = searchParams.get('sort') || 'recommended';
    const spoilerFilter = searchParams.get('spoilerLevel');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const authUser = await getAuthUserFromRequest(request);

    const where: any = {
      deletedAt: null,
      status: 'PUBLISHED',
    };

    let canonicalAnimeId: string | null = null;
    if (animeId) {
      const anime = await prisma.anime.findFirst({
        where: { OR: [{ id: animeId }, { slug: animeId }] },
        select: { id: true },
      });
      if (anime) {
        canonicalAnimeId = anime.id;
        where.animeId = anime.id;
      } else {
        where.animeId = animeId;
      }
    }

    if (episodeId) {
      where.episodeId = episodeId;
    }

    const username = searchParams.get('username');
    if (username) {
      const targetUser = await prisma.user.findFirst({
        where: { username },
        select: { id: true },
      });
      if (targetUser) {
        where.userId = targetUser.id;
      } else {
        where.userId = 'no_such_user_found';
      }
    } else if (userId) {
      where.userId = userId;
    }

    if (spoilerFilter) {
      if (spoilerFilter === 'SPOILER_FREE' || spoilerFilter === 'spoiler_free') {
        where.spoilerLevel = 'SPOILER_FREE';
      } else if (spoilerFilter === 'hide_spoilers') {
        where.spoilerLevel = { in: ['SPOILER_FREE', 'MILD_SPOILERS'] };
      } else {
        where.spoilerLevel = spoilerFilter;
      }
    }

    // Determine sort order
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'helpful') {
      orderBy = { likesCount: 'desc' };
    } else if (sort === 'highest_rated' || sort === 'positive') {
      orderBy = [{ rating: 'desc' }, { likesCount: 'desc' }];
    } else if (sort === 'lowest_rated' || sort === 'critical') {
      orderBy = [{ rating: 'asc' }, { likesCount: 'desc' }];
    } else if (sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sort === 'recommended') {
      orderBy = [{ likesCount: 'desc' }, { createdAt: 'desc' }];
    }

    // Fetch reviews and total count
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          anime: {
            select: {
              id: true,
              slug: true,
              canonicalTitle: true,
              posterUrl: true,
              type: true,
              year: true,
            },
          },
          aspects: true,
        },
      }),
      prisma.review.count({ where }),
    ]);

    // Check auth user's reaction states for these reviews
    let userLikedReviewIds = new Set<string>();
    let userReview: any = null;

    if (authUser) {
      const reviewIds = reviews.map((r) => r.id);
      if (reviewIds.length > 0) {
        const reactions = await prisma.reviewLike.findMany({
          where: {
            userId: authUser.id,
            reviewId: { in: reviewIds },
            reactionType: 'HELPFUL',
          },
          select: { reviewId: true },
        });
        reactions.forEach((re) => userLikedReviewIds.add(re.reviewId));
      }

      // If viewing an anime, fetch the user's own review if present
      if (canonicalAnimeId) {
        const existingOwnReview = await prisma.review.findFirst({
          where: {
            userId: authUser.id,
            animeId: canonicalAnimeId,
            deletedAt: null,
          },
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
            anime: {
              select: {
                id: true,
                slug: true,
                canonicalTitle: true,
                posterUrl: true,
                type: true,
                year: true,
              },
            },
            aspects: true,
          },
        });

        if (existingOwnReview) {
          userReview = {
            id: existingOwnReview.id,
            title: existingOwnReview.title,
            body: existingOwnReview.body,
            rating: existingOwnReview.rating,
            spoilerLevel: existingOwnReview.spoilerLevel,
            containsSpoiler: existingOwnReview.containsSpoiler,
            watchStatusAtReview: existingOwnReview.watchStatusAtReview,
            episodeProgressAtReview: existingOwnReview.episodeProgressAtReview,
            edited: existingOwnReview.edited,
            likesCount: existingOwnReview.likesCount,
            overallSentiment: existingOwnReview.overallSentiment,
            reviewType: existingOwnReview.reviewType,
            createdAt: existingOwnReview.createdAt.toISOString(),
            updatedAt: existingOwnReview.updatedAt.toISOString(),
            isOwnReview: true,
            user: {
              id: existingOwnReview.user.id,
              username: existingOwnReview.user.username,
              avatarUrl: existingOwnReview.user.avatarUrl,
            },
            anime: {
              id: existingOwnReview.anime.id,
              slug: existingOwnReview.anime.slug,
              title: getAnimeDisplayTitle(existingOwnReview.anime),
              canonicalTitle: getAnimeDisplayTitle(existingOwnReview.anime),
              posterImage: existingOwnReview.anime.posterUrl,
              type: existingOwnReview.anime.type,
              year: existingOwnReview.anime.year,
            },
            aspects: existingOwnReview.aspects.map((a) => ({
              aspect: a.aspect,
              sentiment: a.sentiment,
              sentimentScore: a.sentimentScore,
              confidence: a.confidence,
            })),
          };
        }
      }
    }

    const parsed = reviews.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      rating: r.rating,
      spoilerLevel: r.spoilerLevel,
      containsSpoiler: r.containsSpoiler,
      watchStatusAtReview: r.watchStatusAtReview,
      episodeProgressAtReview: r.episodeProgressAtReview,
      edited: r.edited,
      likesCount: r.likesCount,
      overallSentiment: r.overallSentiment,
      reviewType: r.reviewType,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      userLiked: userLikedReviewIds.has(r.id),
      isOwnReview: authUser ? r.user.id === authUser.id : false,
      user: {
        id: r.user.id,
        username: r.user.username,
        avatarUrl: r.user.avatarUrl,
      },
      anime: {
        id: r.anime.id,
        slug: r.anime.slug,
        title: getAnimeDisplayTitle(r.anime),
        canonicalTitle: getAnimeDisplayTitle(r.anime),
        posterImage: r.anime.posterUrl,
        type: r.anime.type,
        year: r.anime.year,
      },
      aspects: r.aspects.map((a) => ({
        aspect: a.aspect,
        sentiment: a.sentiment,
        sentimentScore: a.sentimentScore,
        confidence: a.confidence,
      })),
    }));

    return NextResponse.json({
      reviews: parsed,
      userReview,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to write a review' }, { status: 401 });
    }

    const body = await request.json();
    const { animeId, episodeId, episodeNumber, title, body: reviewBody, rating, spoilerLevel, containsSpoiler } = body;

    if (!animeId || !title?.trim() || !reviewBody?.trim()) {
      return NextResponse.json({ error: 'animeId, title, and review body are required' }, { status: 400 });
    }

    const trimmedTitle = title.trim();
    const trimmedBody = reviewBody.trim();

    if (trimmedTitle.length > 120) {
      return NextResponse.json({ error: 'Review headline cannot exceed 120 characters' }, { status: 400 });
    }

    if (trimmedBody.length < 20) {
      return NextResponse.json({ error: 'Review body must be at least 20 characters long' }, { status: 400 });
    }

    if (trimmedBody.length > 5000) {
      return NextResponse.json({ error: 'Review body cannot exceed 5,000 characters' }, { status: 400 });
    }

    // Resolve canonical anime ID
    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeId }, { slug: animeId }] },
      select: { id: true },
    });
    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }
    const canonicalAnimeId = anime.id;

    // Validate rating: null or 0.5 to 10.0 in 0.5 increments
    let parsedRating: number | null = null;
    if (rating !== null && rating !== undefined && rating !== '') {
      const num = Number(rating);
      if (isNaN(num) || num < 0.5 || num > 10.0) {
        return NextResponse.json({ error: 'Rating must be between 0.5 and 10.0' }, { status: 400 });
      }
      parsedRating = Math.round(num * 2) / 2;
    }

    // Validate spoiler level
    const validLevels = ['SPOILER_FREE', 'MILD_SPOILERS', 'SPOILERS', 'FULL_SPOILERS'] as const;
    let validatedSpoilerLevel: (typeof validLevels)[number] = 'SPOILER_FREE';
    if (spoilerLevel && validLevels.includes(spoilerLevel)) {
      validatedSpoilerLevel = spoilerLevel;
    } else if (containsSpoiler) {
      validatedSpoilerLevel = 'SPOILERS';
    }

    // Query user's current watch status from UserAnime to snapshot context
    const userAnime = await prisma.userAnime.findUnique({
      where: {
        userId_animeId: {
          userId: authUser.id,
          animeId: canonicalAnimeId,
        },
      },
      select: { status: true, episodesWatched: true },
    });

    const { review, extractedAspects } = await createAndAnalyzeReview({
      userId: authUser.id,
      animeId: canonicalAnimeId,
      episodeId,
      episodeNumber,
      title: trimmedTitle,
      body: trimmedBody,
      rating: parsedRating,
      spoilerLevel: validatedSpoilerLevel,
      containsSpoiler: validatedSpoilerLevel !== 'SPOILER_FREE',
      watchStatusAtReview: userAnime?.status || null,
      episodeProgressAtReview: userAnime?.episodesWatched ?? null,
    });

    return NextResponse.json({
      success: true,
      review: {
        ...review,
        aspects: extractedAspects,
      },
    });
  } catch (error: any) {
    console.error('Error creating review:', error);
    const status = error.message === 'Anime not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to create review' }, { status });
  }
}
