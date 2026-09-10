import { NextRequest, NextResponse } from 'next/server';
import { studioProjectService } from '../../../../../lib/engine/studio/studioProjectService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q') || searchParams.get('search') || undefined;
    const format = searchParams.get('format') || undefined;
    const status = searchParams.get('status') || undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const role = searchParams.get('role') || undefined;
    const isPrimary = searchParams.get('isPrimary') ? searchParams.get('isPrimary') === 'true' : undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'score';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await studioProjectService.getStudioProjects(slug, {
      q,
      format,
      status,
      year,
      role,
      isPrimary,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    if (!result.studio) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/studios/[slug]/projects:', error);
    return NextResponse.json({ error: 'Failed to fetch studio projects' }, { status: 500 });
  }
}
