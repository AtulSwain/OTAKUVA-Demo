import { NextRequest, NextResponse } from 'next/server';
import { newsEngine } from '../../../../lib/engine/news/newsEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const articles = await newsEngine.getLatestNews(limit);
    return NextResponse.json({ articles });
  } catch (error: any) {
    console.error('Error fetching latest news:', error);
    return NextResponse.json({ error: 'Failed to fetch latest news' }, { status: 500 });
  }
}
