import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { addAnimeToList, ListError } from '../../../../../lib/lists/listService';

export const dynamic = 'force-dynamic';

/** POST /api/lists/:id/items { animeId } — idempotent (adding twice is a no-op). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const result = await addAnimeToList(authUser.id, params.id, body?.animeId);
    return NextResponse.json(result, { status: result.added ? 201 : 200 });
  } catch (e) {
    if (e instanceof ListError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error('Error adding anime to list:', e);
    return NextResponse.json({ error: 'Failed to add to list' }, { status: 500 });
  }
}
