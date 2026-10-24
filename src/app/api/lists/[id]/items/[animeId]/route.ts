import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { ListError, removeAnimeFromList } from '../../../../../../lib/lists/listService';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; animeId: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    return NextResponse.json(await removeAnimeFromList(authUser.id, params.id, params.animeId));
  } catch (e) {
    if (e instanceof ListError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error('Error removing anime from list:', e);
    return NextResponse.json({ error: 'Failed to remove from list' }, { status: 500 });
  }
}
