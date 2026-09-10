import { NextRequest, NextResponse } from 'next/server';
import { getAnimeVideosData, getAnimeBySlugOrId } from '../../../../../lib/animeData';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const anime = await getAnimeBySlugOrId(params.id);
    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const videos = await getAnimeVideosData(anime.id);

    return NextResponse.json({
      animeId: anime.id,
      slug: anime.slug,
      videos,
    });
  } catch (error: any) {
    console.error('Videos API error:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
