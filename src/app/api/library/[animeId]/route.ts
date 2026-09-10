import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { recalculateAnimeAggregates } from '../../../../lib/rating/ratingService';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['WATCHING', 'COMPLETED', 'PLAN_TO_WATCH', 'ON_HOLD', 'DROPPED'];

export async function GET(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ inLibrary: false, watchedEpisodes: [] });
    }
    const userId = authUser.id;
    const animeId = params.animeId;

    const [userAnime, rating, favorite, watchedRecords] = await Promise.all([
      prisma.userAnime.findUnique({
        where: { userId_animeId: { userId, animeId } },
        include: { anime: true },
      }),
      prisma.animeRating.findUnique({
        where: { userId_animeId: { userId, animeId } },
      }),
      prisma.favorite.findUnique({
        where: { userId_animeId: { userId, animeId } },
      }),
      prisma.userEpisodeProgress.findMany({
        where: { userId, animeId },
        include: { episode: true },
      }),
    ]);

    const watchedEpisodes = watchedRecords.map((r) => r.episode.number).sort((a, b) => a - b);

    if (!userAnime) {
      return NextResponse.json({ inLibrary: false, watchedEpisodes });
    }

    return NextResponse.json({
      inLibrary: true,
      data: {
        ...userAnime,
        status: userAnime.status.toLowerCase(),
        personalRating: rating?.rating || null,
        isFavorite: Boolean(favorite),
      },
      watchedEpisodes,
    });
  } catch (error: any) {
    console.error('Error fetching user anime:', error);
    return NextResponse.json({ error: 'Failed to fetch anime status' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required to update library state', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }
    const userId = authUser.id;
    const animeId = params.animeId;
    const body = await request.json();

    const { status, personalRating, isFavorite, notes, episodesWatched } = body;

    let normalizedStatus: string | undefined;
    if (status) {
      const upper = status.toUpperCase().replace(/\s+/g, '_');
      if (!VALID_STATUSES.includes(upper)) {
        return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
      }
      normalizedStatus = upper;
    }

    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeId }, { slug: animeId }] },
    });

    if (!anime) {
      return NextResponse.json({ error: 'Anime not found in database' }, { status: 404 });
    }

    const resolvedAnimeId = anime.id;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.userAnime.findUnique({
        where: { userId_animeId: { userId, animeId: resolvedAnimeId } },
      });

      const updateData: any = {};
      if (normalizedStatus !== undefined) updateData.status = normalizedStatus;
      if (notes !== undefined) updateData.notes = notes;
      if (episodesWatched !== undefined) updateData.episodesWatched = episodesWatched;

      if (normalizedStatus === 'COMPLETED' && (!existing || !existing.finishDate)) {
        updateData.finishDate = new Date().toISOString().split('T')[0];
      }

      let updatedRecord;
      if (existing) {
        updatedRecord = await tx.userAnime.update({
          where: { id: existing.id },
          data: updateData,
        });
      } else {
        updatedRecord = await tx.userAnime.create({
          data: {
            userId,
            animeId: resolvedAnimeId,
            status: normalizedStatus || 'PLAN_TO_WATCH',
            episodesWatched: episodesWatched || 0,
            notes: notes || null,
            startDate: normalizedStatus === 'WATCHING' ? new Date().toISOString().split('T')[0] : null,
          },
        });
      }

      // Record Activity on status change
      if (normalizedStatus && (!existing || existing.status !== normalizedStatus)) {
        await tx.activity.create({
          data: {
            userId,
            type: 'STATUS_CHANGED',
            animeId: resolvedAnimeId,
            metadata: JSON.stringify({ status: normalizedStatus }),
          },
        });
      }

      // Handle Rating update
      if (personalRating !== undefined) {
        if (personalRating !== null && personalRating >= 0.5 && personalRating <= 10) {
          const cleanScore = Math.round(personalRating * 2) / 2;
          await tx.animeRating.upsert({
            where: { userId_animeId: { userId, animeId: resolvedAnimeId } },
            update: { rating: cleanScore, deletedAt: null },
            create: { userId, animeId: resolvedAnimeId, rating: cleanScore },
          });

          await tx.activity.create({
            data: {
              userId,
              type: 'ANIME_RATED',
              animeId: resolvedAnimeId,
              metadata: JSON.stringify({ rating: cleanScore }),
            },
          });
        } else if (personalRating === null) {
          await tx.animeRating.updateMany({
            where: { userId, animeId: resolvedAnimeId },
            data: { deletedAt: new Date() },
          });
        }
      }

      // Handle Favorite update
      if (isFavorite !== undefined) {
        if (isFavorite) {
          await tx.favorite.upsert({
            where: { userId_animeId: { userId, animeId: resolvedAnimeId } },
            update: {},
            create: { userId, animeId: resolvedAnimeId },
          });
        } else {
          await tx.favorite.deleteMany({
            where: { userId, animeId: resolvedAnimeId },
          });
        }
      }

      // Re-fetch all counts
      const allEntries = await tx.userAnime.findMany({
        where: { userId },
        select: { status: true },
      });

      const counts = {
        watching: allEntries.filter((a) => a.status === 'WATCHING').length,
        completed: allEntries.filter((a) => a.status === 'COMPLETED').length,
        plan_to_watch: allEntries.filter((a) => a.status === 'PLAN_TO_WATCH').length,
        on_hold: allEntries.filter((a) => a.status === 'ON_HOLD').length,
        dropped: allEntries.filter((a) => a.status === 'DROPPED').length,
        total: allEntries.length,
      };

      return {
        item: {
          ...updatedRecord,
          status: updatedRecord.status.toLowerCase(),
          personalRating,
          isFavorite,
        },
        counts,
      };
    });

    if (personalRating !== undefined) {
      recalculateAnimeAggregates(resolvedAnimeId).catch((err) => {
        console.error('Error recalculating aggregates on library update:', err);
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error updating user anime:', error);
    return NextResponse.json({ error: 'Failed to update library state' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required to remove from library', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }
    const userId = authUser.id;
    const animeId = params.animeId;

    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeId }, { slug: animeId }] },
    });

    const resolvedId = anime ? anime.id : animeId;

    const result = await prisma.$transaction(async (tx) => {
      await tx.userEpisodeProgress.deleteMany({
        where: { userId, animeId: resolvedId },
      });
      await tx.animeRating.deleteMany({
        where: { userId, animeId: resolvedId },
      });
      await tx.favorite.deleteMany({
        where: { userId, animeId: resolvedId },
      });
      await tx.userAnime.deleteMany({
        where: { userId, animeId: resolvedId },
      });

      const allEntries = await tx.userAnime.findMany({
        where: { userId },
        select: { status: true },
      });

      const counts = {
        watching: allEntries.filter((a) => a.status === 'WATCHING').length,
        completed: allEntries.filter((a) => a.status === 'COMPLETED').length,
        plan_to_watch: allEntries.filter((a) => a.status === 'PLAN_TO_WATCH').length,
        on_hold: allEntries.filter((a) => a.status === 'ON_HOLD').length,
        dropped: allEntries.filter((a) => a.status === 'DROPPED').length,
        total: allEntries.length,
      };

      return { success: true, animeId: resolvedId, counts };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error removing from library:', error);
    return NextResponse.json({ error: 'Failed to remove from library' }, { status: 500 });
  }
}
