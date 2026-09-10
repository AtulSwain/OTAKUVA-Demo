import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { studioCommunityService } from '../../../../../lib/engine/studio/studioCommunityService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const { slug } = params;
    const { searchParams } = new URL(req.url);

    const visibility = (searchParams.get('visibility') as any) || 'ALL';
    const sortBy = (searchParams.get('sortBy') as any) || 'members';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await studioCommunityService.getStudioCommunities(
      slug,
      authUser?.id || null,
      {
        visibility,
        sortBy,
        page,
        limit,
      }
    );

    if (!result.studio) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching studio communities:', error);
    return NextResponse.json({ error: 'Failed to fetch studio communities' }, { status: 500 });
  }
}
