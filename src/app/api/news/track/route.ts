import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { emitEngineEvent } from '../../../../lib/engine/events/eventEngine';
import { EngineEventType } from '../../../../lib/engine/events/eventTypes';

export const dynamic = 'force-dynamic';

const PERMITTED_TRACKING_EVENTS = new Set<EngineEventType>([
  'NEWS_OPENED',
  'NEWS_SOURCE_OPENED',
  'NEWS_SHARED',
  'NEWS_RELATED_ENTITY_OPENED',
  'NEWS_SEARCHED',
  'NEWS_CATEGORY_OPENED',
]);

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const body = await req.json();
    const { eventType, articleId, metadata = {} } = body;

    if (!eventType || !PERMITTED_TRACKING_EVENTS.has(eventType)) {
      return NextResponse.json({ error: 'Invalid tracking event type' }, { status: 400 });
    }

    if (!articleId || typeof articleId !== 'string') {
      return NextResponse.json({ error: 'Missing articleId' }, { status: 400 });
    }

    // Record interaction event asynchronously
    await emitEngineEvent({
      eventType,
      userId: authUser?.id,
      entityType: 'NEWS',
      entityId: articleId,
      metadata: {
        ...metadata,
        userAgent: req.headers.get('user-agent')?.slice(0, 100),
      },
    });

    return NextResponse.json({ success: true, tracked: eventType });
  } catch (error: any) {
    console.error('Error recording news interaction event:', error);
    // Return 200 even on error so client analytics never blocks UI interaction
    return NextResponse.json({ success: false, error: 'Tracking error suppressed' });
  }
}
