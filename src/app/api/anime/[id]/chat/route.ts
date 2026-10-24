import { NextRequest, NextResponse } from 'next/server';
import { validateIdOrSlug } from '../../../../../lib/security/apiValidator';
import { AnimeCatalogEngine } from '../../../../../lib/engine/anime/animeCatalogEngine';
import { requireVerifiedUser } from '../../../../../lib/auth';
import {
  getOrCreateAnimeRoomConversation,
  getConversationMessages,
} from '../../../../../lib/chat/chatService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/anime/:id/chat
 * Resolves (creating on first visit) the anime's persistent live chat room
 * and returns its recent messages. Requires a verified account, same gate as
 * community chat — this is a live room, not the public read-only dossier.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await requireVerifiedUser(request);
    if (authUser instanceof NextResponse) return authUser;

    const validation = validateIdOrSlug(params.id);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error || 'Invalid anime identifier' }, { status: 400 });
    }

    const anime = await AnimeCatalogEngine.getAnimeByIdOrSlug(validation.value, authUser.id);
    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const room = await getOrCreateAnimeRoomConversation(authUser.id, anime.id);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const before = url.searchParams.get('before') || undefined;
    const messages = await getConversationMessages(authUser.id, room.id, limit, before);

    return NextResponse.json({
      conversationId: room.id,
      animeId: anime.id,
      animeTitle: room.animeTitle,
      animePosterUrl: room.animePosterUrl,
      messages,
    });
  } catch (error: any) {
    console.error('Error opening anime chat room:', error);
    return NextResponse.json({ error: error.message || 'Failed to open chat room' }, { status: 500 });
  }
}
