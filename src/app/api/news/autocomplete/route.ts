import { NextRequest, NextResponse } from 'next/server';
import { newsSearchService } from '../../../../lib/engine/news/newsSearchService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '6', 10);

    const suggestions = await newsSearchService.autocomplete(query, limit);
    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Error fetching autocomplete suggestions:', error);
    return NextResponse.json({ suggestions: [] });
  }
}
