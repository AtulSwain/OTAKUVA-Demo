import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import {
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
} from '../../../../../lib/chat/chatService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/:id/messages
 * Retrieves paginated message history for a conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required to view messages', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    const conversationId = params.id;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const before = url.searchParams.get('before') || undefined;

    const messages = await getConversationMessages(authUser.id, conversationId, limit, before);

    // Asynchronously mark as read
    markConversationAsRead(authUser.id, conversationId).catch((err: any) => {
      console.error('Error marking conversation as read:', err);
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to fetch messages' }, { status });
  }
}

/**
 * POST /api/conversations/:id/messages
 * Sends a new message in the conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required to send messages', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    const conversationId = params.id;
    const body = await request.json();
    const { content, messageType, mediaUrl, replyToId } = body;

    const message = await sendMessage(authUser.id, conversationId, {
      content,
      messageType,
      mediaUrl,
      replyToId,
    });

    return NextResponse.json({ message });
  } catch (error: any) {
    console.error('Error sending message:', error);
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status });
  }
}
