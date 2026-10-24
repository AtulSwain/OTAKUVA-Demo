import { NextResponse } from 'next/server';
import { getGenreArtwork } from '../../../../lib/browseService';

export const dynamic = 'force-dynamic';

/** GET /api/browse/genres — artwork and title count for each browse genre. */
export async function GET() {
  try {
    const genres = await getGenreArtwork();
    return NextResponse.json({ genres }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } });
  } catch (error) {
    console.error('Error loading genre artwork:', error);
    return NextResponse.json({ genres: [] }, { status: 200 });
  }
}
