import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { hasMinRole } from '../../../../lib/roles';
import { studioAdminService } from '../../../../lib/engine/studio/studioAdminService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized access to studio management.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || searchParams.get('search') || undefined;
    const status = (searchParams.get('status') as any) || undefined;
    const country = searchParams.get('country') || undefined;
    const foundedYearMin = searchParams.get('foundedYearMin') ? parseInt(searchParams.get('foundedYearMin')!, 10) : undefined;
    const foundedYearMax = searchParams.get('foundedYearMax') ? parseInt(searchParams.get('foundedYearMax')!, 10) : undefined;
    const verificationStatus = (searchParams.get('verificationStatus') as any) || undefined;
    const publicationState = (searchParams.get('publicationState') as any) || undefined;
    const hasImage = searchParams.get('hasImage') === 'true' ? true : undefined;
    const hasFounder = searchParams.get('hasFounder') === 'true' ? true : undefined;
    const hasAnime = searchParams.get('hasAnime') === 'true' ? true : undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const [listResult, stats] = await Promise.all([
      studioAdminService.getAdminStudios({
        q,
        status,
        country,
        foundedYearMin,
        foundedYearMax,
        verificationStatus,
        publicationState,
        hasImage,
        hasFounder,
        hasAnime,
        sortBy,
        sortOrder,
        page,
        limit,
      }),
      studioAdminService.getAdminStudioStats(),
    ]);

    return NextResponse.json({
      ...listResult,
      stats,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch admin studios' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. Studio creation requires DATA_EDITOR or higher role.' }, { status: 403 });
    }

    const body = await req.json();
    const created = await studioAdminService.createStudio(authUser.id, body);

    return NextResponse.json({ success: true, studio: created });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios:', error);
    return NextResponse.json({ error: error.message || 'Failed to create studio' }, { status: 400 });
  }
}
