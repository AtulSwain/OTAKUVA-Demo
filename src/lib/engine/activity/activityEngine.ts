/**
 * OTAKUVA ACTIVITY ENGINE
 * Aggregates trustworthy user activities into chronological timeline feeds.
 */

import { prisma } from '../../prisma';
import { EngineEventPayload } from '../events/eventTypes';
import { registerEventListener } from '../events/eventEngine';

export async function recordActivityFromEvent(event: EngineEventPayload) {
  const { eventType, userId, entityType, entityId, metadata = {} } = event;

  let activityType = eventType;
  // Map event types to existing activity format if needed
  try {
    await prisma.activity.create({
      data: {
        userId,
        type: activityType,
        metadata: JSON.stringify({
          entityType,
          entityId,
          ...metadata,
        }),
      },
    });
  } catch (err) {
    console.error('[ActivityEngine] Failed to record activity:', err);
  }
}

// Automatically register activity recorder on the event stream
registerEventListener('*', async (event) => {
  // Only record user-facing timeline activities
  const userTimelineEvents = [
    'ANIME_BOOKMARKED',
    'EPISODE_COMPLETED',
    'ANIME_COMPLETED',
    'EPISODE_RATED',
    'ANIME_RATED',
    'REVIEW_CREATED',
    'COMMUNITY_CREATED',
    'COMMUNITY_JOINED',
  ];

  if (userTimelineEvents.includes(event.eventType)) {
    await recordActivityFromEvent(event);
  }
});

/**
 * Get user's activity timeline
 */
export async function getUserActivityTimeline(userId: string, limit = 20) {
  return prisma.activity.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: { id: true, username: true, avatarUrl: true },
      },
    },
  });
}
