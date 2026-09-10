import { NextRequest, NextResponse } from 'next/server';
import { fetchDanbooruArtistAbout } from '../../../../lib/providers/danbooruProvider';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || '';

    if (!name) {
      return NextResponse.json({ error: 'Artist/creator name is required' }, { status: 400 });
    }

    const artistInfo = await fetchDanbooruArtistAbout(name);

    return NextResponse.json({
      artist: artistInfo,
    });
  } catch (error: any) {
    console.error('Error in Danbooru artist about route:', error);
    return NextResponse.json({ error: 'Failed to fetch artist details' }, { status: 500 });
  }
}
