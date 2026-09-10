import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { toggleBookmark } from '../../../../../lib/engine/watch/watchEngine';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to bookmark anime' }, { status: 401 });
    }

    const { id } = params;
    const result = await toggleBookmark(authUser.id, id);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error toggling bookmark:', error);
    const status = error.message === 'Anime not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to toggle bookmark' }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;
    const result = await toggleBookmark(authUser.id, id);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error removing bookmark:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove bookmark' }, { status: 500 });
  }
}
