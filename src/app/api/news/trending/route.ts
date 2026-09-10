import { NextRequest, NextResponse } from 'next/server';
import { newsTrendingService } from '../../../../lib/engine/news/newsTrendingService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const window = (searchParams.get('window') || '24h') as any;
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '15', 10);

    const result = await newsTrendingService.getTrendingNews({
      window,
      category,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching trending news:', error);
    return NextResponse.json({ error: 'Failed to retrieve trending news' }, { status: 500 });
  }
}
