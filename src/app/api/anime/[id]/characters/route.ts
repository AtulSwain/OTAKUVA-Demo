import { NextRequest, NextResponse } from 'next/server';
import { getAnimeCharactersData, getAnimeBySlugOrId } from '../../../../../lib/animeData';

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

    const characters = await getAnimeCharactersData(anime.id);

    return NextResponse.json({
      animeId: anime.id,
      slug: anime.slug,
      characters,
      totalCharacters: characters.length,
    });
  } catch (error: any) {
    console.error('Characters API error:', error);
    return NextResponse.json({ error: 'Failed to fetch characters' }, { status: 500 });
  }
}
