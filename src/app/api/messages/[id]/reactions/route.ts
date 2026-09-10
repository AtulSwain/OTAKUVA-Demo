import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { toggleMessageReaction } from '../../../../../lib/chat/chatService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/messages/:id/reactions
 * Toggles an emoji reaction on a message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required to react to messages', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    const messageId = params.id;
    const body = await request.json();
    const { emoji } = body;

    if (!emoji || typeof emoji !== 'string') {
      return NextResponse.json({ error: 'Valid emoji string is required' }, { status: 400 });
    }

    const result = await toggleMessageReaction(authUser.id, messageId, emoji);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error toggling reaction:', error);
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ error: error.message || 'Failed to toggle reaction' }, { status });
  }
}
