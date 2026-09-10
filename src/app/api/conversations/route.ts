import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import {
  getUserConversations,
  getOrCreateDirectConversation,
  createGroupConversation,
} from '../../../lib/chat/chatService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations
 * Returns conversations for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required to access conversations', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    const conversations = await getUserConversations(authUser.id);
    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch conversations' }, { status: 500 });
  }
}

/**
 * POST /api/conversations
 * Creates a direct or group conversation
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required to start conversation', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, recipientId, title, participantIds, avatarUrl } = body;

    if (type === 'DIRECT' || recipientId) {
      if (!recipientId) {
        return NextResponse.json({ error: 'recipientId is required for direct conversations' }, { status: 400 });
      }
      const result = await getOrCreateDirectConversation(authUser.id, recipientId);
      return NextResponse.json(result);
    } else if (type === 'GROUP') {
      if (!title || !participantIds || !Array.isArray(participantIds)) {
        return NextResponse.json(
          { error: 'title and participantIds array are required for group conversations' },
          { status: 400 }
        );
      }
      const result = await createGroupConversation(authUser.id, title, participantIds, avatarUrl);
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: 'Invalid conversation type. Must be DIRECT or GROUP' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: error.message || 'Failed to create conversation' }, { status: 500 });
  }
}
