import { NextRequest, NextResponse } from 'next/server';
import { getAnimeRelationsData, getAnimeBySlugOrId } from '../../../../../lib/animeData';

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

    const relations = await getAnimeRelationsData(anime.id);

    return NextResponse.json({
      animeId: anime.id,
      slug: anime.slug,
      relations,
    });
  } catch (error: any) {
    console.error('Relations API error:', error);
    return NextResponse.json({ error: 'Failed to fetch relations' }, { status: 500 });
  }
}
