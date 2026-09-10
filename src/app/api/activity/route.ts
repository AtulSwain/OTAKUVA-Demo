import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { getUserActivityTimeline } from '../../../lib/engine/activity/activityEngine';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || authUser?.id;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (userId) {
      const activities = await getUserActivityTimeline(userId, limit);
      return NextResponse.json({ activities, total: activities.length });
    }

    // Public recent activity feed across all users
    const publicActivities = await prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ activities: publicActivities, total: publicActivities.length });
  } catch (error: any) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch activity feed' }, { status: 500 });
  }
}
