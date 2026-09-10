import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    const userId = authUser ? authUser.id : 'user_default';

    const [userAnimes, totalEpisodeRecords, ratings] = await Promise.all([
      prisma.userAnime.findMany({
        where: { userId },
      }),
      prisma.userEpisodeProgress.findMany({
        where: { userId },
      }),
      prisma.animeRating.findMany({
        where: { userId },
      }),
    ]);

    const completedCount = userAnimes.filter((a) => a.status === 'COMPLETED').length;
    const watchingCount = userAnimes.filter((a) => a.status === 'WATCHING').length;
    const planToWatchCount = userAnimes.filter((a) => a.status === 'PLAN_TO_WATCH').length;
    const onHoldCount = userAnimes.filter((a) => a.status === 'ON_HOLD').length;
    const droppedCount = userAnimes.filter((a) => a.status === 'DROPPED').length;
    const episodesWatched = totalEpisodeRecords.length;

    // Estimate watch time (average ~23.5 minutes per episode)
    const totalMinutes = episodesWatched * 23.5;
    const estimatedHours = (totalMinutes / 60).toFixed(1);

    // Calculate mean score from AnimeRating
    const meanScore =
      ratings.length > 0
        ? (ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length).toFixed(1)
        : '0.0';

    return NextResponse.json({
      userId,
      totalAnime: userAnimes.length,
      completedCount,
      watchingCount,
      planToWatchCount,
      onHoldCount,
      droppedCount,
      episodesWatched,
      estimatedHours: `${estimatedHours} hrs`,
      meanScore: parseFloat(meanScore),
    });
  } catch (error: any) {
    console.error('Error calculating statistics:', error);
    return NextResponse.json({ error: 'Failed to calculate stats' }, { status: 500 });
  }
}
