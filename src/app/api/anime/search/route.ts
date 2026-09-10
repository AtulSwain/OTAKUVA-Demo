import { NextRequest, NextResponse } from 'next/server';
import { searchCatalog } from '../../../../lib/search';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q') || undefined;
    const genre = searchParams.get('genre') || undefined;
    const theme = searchParams.get('theme') || undefined;
    const studio = searchParams.get('studio') || undefined;
    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;
    const season = searchParams.get('season') || undefined;
    const yearStr = searchParams.get('year');
    const year = yearStr && yearStr !== 'All' ? parseInt(yearStr, 10) : undefined;
    const minScoreStr = searchParams.get('minScore');
    const minScore = minScoreStr ? parseFloat(minScoreStr) : undefined;
    const maxScoreStr = searchParams.get('maxScore');
    const maxScore = maxScoreStr ? parseFloat(maxScoreStr) : undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'score';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '24', 10));

    const result = await searchCatalog({
      query,
      genre,
      theme,
      studio,
      type,
      status,
      season,
      year,
      minScore,
      maxScore,
      sortBy,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Failed to search anime catalog' }, { status: 500 });
  }
}
