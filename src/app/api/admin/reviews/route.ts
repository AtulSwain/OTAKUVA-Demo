import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { recalculateAnimeAggregates } from '../../../../lib/rating/ratingService';
import { getAnimeDisplayTitle } from '../../../../lib/animeTitleResolver';

export const dynamic = 'force-dynamic';

const MODERATION_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'MODERATOR']);

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser || !MODERATION_ROLES.has(authUser.role)) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Moderator access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'ALL';
    const hasReports = searchParams.get('hasReports') === 'true';
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (statusFilter !== 'ALL') {
      where.status = statusFilter;
    }

    if (hasReports) {
      where.reports = { some: { status: 'PENDING' } };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { body: { contains: search } },
        { user: { username: { contains: search } } },
        { anime: { canonicalTitle: { contains: search } } },
      ];
    }

    const [reviews, total, pendingReportsCount] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true, role: true } },
          anime: {
            select: {
              id: true,
              slug: true,
              canonicalTitle: true,
              posterUrl: true,
            },
          },
          reports: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: { select: { id: true, username: true } },
            },
          },
          _count: {
            select: {
              reports: true,
              likes: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
      prisma.reviewReport.count({ where: { status: 'PENDING' } }),
    ]);

    const formatted = reviews.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      rating: r.rating,
      spoilerLevel: r.spoilerLevel,
      status: r.status,
      likesCount: r.likesCount,
      reportCount: r._count.reports,
      pendingReportCount: r.reports.filter((rep: any) => rep.status === 'PENDING').length,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      user: {
        id: r.user.id,
        username: r.user.username,
        avatarUrl: r.user.avatarUrl,
        role: r.user.role,
      },
      anime: {
        id: r.anime.id,
        slug: r.anime.slug,
        title: getAnimeDisplayTitle(r.anime),
        posterUrl: r.anime.posterUrl,
      },
      reports: r.reports.map((rep: any) => ({
        id: rep.id,
        reason: rep.reason,
        details: rep.details,
        status: rep.status,
        createdAt: rep.createdAt.toISOString(),
        reporter: rep.user.username,
      })),
    }));

    return NextResponse.json({
      reviews: formatted,
      total,
      pendingReportsCount,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in admin reviews GET:', error);
    return NextResponse.json({ error: 'Failed to fetch admin reviews' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser || !MODERATION_ROLES.has(authUser.role)) {
      return NextResponse.json({ error: 'Unauthorized: Admin or Moderator access required' }, { status: 403 });
    }

    const body = await request.json();
    const { reviewId, status, resolveReports } = body;

    if (!reviewId || !status) {
      return NextResponse.json({ error: 'reviewId and target status are required' }, { status: 400 });
    }

    const validStatuses = ['PUBLISHED', 'HIDDEN', 'REMOVED', 'DELETED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid review status' }, { status: 400 });
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, animeId: true, status: true },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rev = await tx.review.update({
        where: { id: reviewId },
        data: {
          status,
          deletedAt: status === 'DELETED' ? new Date() : null,
        },
      });

      if (resolveReports) {
        await tx.reviewReport.updateMany({
          where: { reviewId, status: 'PENDING' },
          data: { status: 'RESOLVED' },
        });
      }

      return rev;
    });

    // Recalculate aggregates if status changed
    if (review.status !== status) {
      await recalculateAnimeAggregates(review.animeId).catch((err: any) =>
        console.error('Failed to recalculate aggregates after moderation:', err)
      );
    }

    return NextResponse.json({
      success: true,
      review: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error: any) {
    console.error('Error moderating review:', error);
    return NextResponse.json({ error: 'Failed to moderate review' }, { status: 500 });
  }
}
