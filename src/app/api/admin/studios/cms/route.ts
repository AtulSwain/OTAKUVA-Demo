import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { hasMinRole } from '../../../../../lib/roles';
import { studioCmsService } from '../../../../../lib/engine/studio/studioCmsService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const verificationStatus = searchParams.get('verificationStatus') || undefined;
    const publicationState = searchParams.get('publicationState') || undefined;
    const country = searchParams.get('country') || undefined;
    const completenessTier = searchParams.get('completenessTier') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = (searchParams.get('sortBy') as any) || 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';

    const result = await studioCmsService.getAdminStudiosList({
      query,
      status,
      verificationStatus,
      publicationState,
      country,
      completenessTier,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/cms:', error);
    return NextResponse.json({ error: error.message || 'Failed to query studio list' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. DATA_EDITOR role required.' }, { status: 403 });
    }

    const body = await req.json();
    const { forceAllowDuplicate = false, ...studioInput } = body;

    const created = await studioCmsService.createStudioWithDuplicateGuard(
      authUser.id,
      studioInput,
      forceAllowDuplicate
    );

    return NextResponse.json({ success: true, studio: created });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/cms:', error);
    if (error.message?.includes('POSSIBLE_DUPLICATE')) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'POSSIBLE_DUPLICATE',
          duplicates: error.duplicates || [],
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Failed to create studio' }, { status: 400 });
  }
}
