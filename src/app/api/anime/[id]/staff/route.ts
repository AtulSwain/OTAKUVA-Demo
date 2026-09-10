import { NextRequest, NextResponse } from 'next/server';
import { getAnimeStaffData, getAnimeBySlugOrId } from '../../../../../lib/animeData';

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

    const staff = await getAnimeStaffData(anime.id);

    return NextResponse.json({
      animeId: anime.id,
      slug: anime.slug,
      staff,
      totalStaff: staff.length,
    });
  } catch (error: any) {
    console.error('Staff API error:', error);
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
}
