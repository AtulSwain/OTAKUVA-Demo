import { NextRequest, NextResponse } from 'next/server';
import { studioNewsService } from '../../../../../lib/engine/studio/studioNewsService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(req.url);

    const category = searchParams.get('category') || undefined;
    const relationType = searchParams.get('relationType') || undefined;
    const query = searchParams.get('q') || searchParams.get('search') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'latest';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await studioNewsService.getStudioNews(slug, {
      category,
      relationType,
      query,
      sortBy,
      page,
      limit,
    });

    if (!result.studio) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching studio news:', error);
    return NextResponse.json({ error: 'Failed to fetch studio news' }, { status: 500 });
  }
}
