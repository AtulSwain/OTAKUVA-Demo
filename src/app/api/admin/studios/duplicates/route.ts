import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { hasMinRole } from '../../../../../lib/roles';
import { studioAdminService } from '../../../../../lib/engine/studio/studioAdminService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug, website, excludeStudioId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required for duplicate check.' }, { status: 400 });
    }

    const matches = await studioAdminService.detectDuplicates({
      name,
      slug,
      website,
      excludeStudioId,
    });

    return NextResponse.json({ matches });
  } catch (error: any) {
    console.error('Error detecting studio duplicates:', error);
    return NextResponse.json({ error: error.message || 'Failed to detect duplicates' }, { status: 400 });
  }
}
