import { NextRequest, NextResponse } from 'next/server';
import { studioHistoryService } from '../../../../../lib/engine/studio/studioHistoryService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);

    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const yearMin = searchParams.get('yearMin') ? parseInt(searchParams.get('yearMin')!, 10) : undefined;
    const yearMax = searchParams.get('yearMax') ? parseInt(searchParams.get('yearMax')!, 10) : undefined;
    const eventType = (searchParams.get('eventType') as any) || undefined;
    const importance = (searchParams.get('importance') as any) || undefined;
    const majorOnly = searchParams.get('majorOnly') === 'true';
    const eraId = searchParams.get('eraId') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'chronological';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await studioHistoryService.getStudioHistory(slug, {
      year,
      yearMin,
      yearMax,
      eventType,
      importance,
      majorOnly,
      eraId,
      sortBy,
      page,
      limit,
    });

    if (!result.studio) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/studios/[slug]/history:', error);
    return NextResponse.json({ error: 'Failed to fetch studio history' }, { status: 500 });
  }
}
