import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioAdminService } from '../../../../../../lib/engine/studio/studioAdminService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { animeId, role = 'MAIN_STUDIO', isPrimary = true } = body;

    if (!animeId) {
      return NextResponse.json({ error: 'animeId is required.' }, { status: 400 });
    }

    const relation = await studioAdminService.linkAnimeToStudio(
      authUser.id,
      id,
      animeId,
      role,
      isPrimary
    );

    return NextResponse.json({ success: true, relation });
  } catch (error: any) {
    console.error('Error linking anime to studio:', error);
    return NextResponse.json({ error: error.message || 'Failed to link anime' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const animeId = searchParams.get('animeId');

    if (!animeId) {
      return NextResponse.json({ error: 'animeId parameter is required.' }, { status: 400 });
    }

    const result = await studioAdminService.unlinkAnimeFromStudio(authUser.id, id, animeId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error unlinking anime from studio:', error);
    return NextResponse.json({ error: error.message || 'Failed to unlink anime' }, { status: 400 });
  }
}
