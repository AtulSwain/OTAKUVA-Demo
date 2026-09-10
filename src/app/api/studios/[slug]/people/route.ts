import { NextRequest, NextResponse } from 'next/server';
import { studioPeopleService } from '../../../../../lib/engine/studio/studioPeopleService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);

    const role = searchParams.get('role') || undefined;
    const isCurrent = searchParams.get('isCurrent') ? searchParams.get('isCurrent') === 'true' : undefined;
    const q = searchParams.get('q') || searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await studioPeopleService.getStudioPeople(slug, {
      role,
      isCurrent,
      q,
      page,
      limit,
    });

    if (!result.studio) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/studios/[slug]/people:', error);
    return NextResponse.json({ error: 'Failed to fetch studio people' }, { status: 500 });
  }
}
