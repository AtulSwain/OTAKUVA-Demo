import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { newsEngine } from '../../../../../lib/engine/news/newsEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const animeIdOrSlug = params.id;

    // Resolve anime by ID or slug
    const anime = await prisma.anime.findFirst({
      where: {
        OR: [{ id: animeIdOrSlug }, { slug: animeIdOrSlug }],
      },
      select: { id: true, canonicalTitle: true },
    });

    if (!anime) {
      return NextResponse.json({ articles: [], total: 0 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    const result = await newsEngine.getNews({
      animeId: anime.id,
      limit,
      page,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching anime news:', error);
    return NextResponse.json({ error: 'Failed to fetch anime news' }, { status: 500 });
  }
}
