import { NextRequest, NextResponse } from 'next/server';
import { awardCompletionMilestones } from '../../../../lib/library/completionMilestones';
import { starRatingsEnabled } from '../../../../lib/rating/starRatings';
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

    // Server-side validation: these come straight from the client.
    if (episodesWatched !== undefined) {
      const cap = anime.episodes && anime.episodes > 0 ? anime.episodes : 5000;
      if (!Number.isInteger(episodesWatched) || episodesWatched < 0 || episodesWatched > cap) {
        return NextResponse.json(
          { error: `episodesWatched must be a whole number from 0 to ${cap}.`, code: 'INVALID_EPISODES_WATCHED' },
          { status: 400 }
        );
      }
    }
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 5000)) {
      return NextResponse.json({ error: 'notes must be text of at most 5000 characters.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.userAnime.findUnique({
        where: { userId_animeId: { userId, animeId: resolvedAnimeId } },
      });

      const updateData: any = {};
      if (normalizedStatus !== undefined) updateData.status = normalizedStatus;
      if (notes !== undefined) updateData.notes = notes;
      if (episodesWatched !== undefined) updateData.episodesWatched = episodesWatched;

      if (normalizedStatus === 'COMPLETED' && (!existing || !existing.finishDate)) {
        // finishDate is a DateTime column. Sending a date-only string made
        // Prisma reject the whole update ("premature end of input. Expected
        // ISO-8601 DateTime"), so marking anything Completed returned a 500
        // and the status never persisted.
        updateData.finishDate = new Date();
      }

      // Finishing a series means every episode is watched: fill progress up to the
      // known total so Episodes and Watch Time on the profile reflect it. Only when
      // the total is on record, and never lowering progress the user already has.
      if (normalizedStatus === 'COMPLETED' && episodesWatched === undefined && anime.episodes && anime.episodes > 0) {
        if (!existing || existing.episodesWatched < anime.episodes) updateData.episodesWatched = anime.episodes;
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
            episodesWatched: episodesWatched ?? updateData.episodesWatched ?? 0,
            notes: notes || null,
            // Same DateTime requirement as finishDate above.
            startDate: normalizedStatus === 'WATCHING' ? new Date() : null,
            // A first add straight to COMPLETED needs its finish date too.
            finishDate: updateData.finishDate ?? null,
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
      // A library "personal rating" is a 1–10 star — ignored while stars are off.
      if (personalRating !== undefined && starRatingsEnabled()) {
        if (personalRating !== null && personalRating >= 0.5 && personalRating <= 10) {
          const cleanScore = Math.round(personalRating * 10) / 10;
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

    // Reaching 10 / 25 / 50 … completed earns its milestone right now.
    if (result?.item?.status === 'completed') await awardCompletionMilestones(userId);

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
      // Soft delete, matching deleteUserRating: the row and its audit events
      // stay, and re-rating later restores it.
      await tx.animeRating.updateMany({
        where: { userId, animeId: resolvedId, deletedAt: null },
        data: { deletedAt: new Date() },
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

    // The removed rating must stop counting toward the OTAKUVA score.
    recalculateAnimeAggregates(resolvedId).catch((err) => {
      console.error('Error recalculating aggregates on library removal:', err);
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error removing from library:', error);
    return NextResponse.json({ error: 'Failed to remove from library' }, { status: 500 });
  }
}
