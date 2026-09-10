import { NextRequest, NextResponse } from 'next/server';
import { studioService } from '../../../lib/engine/studio/studioService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || searchParams.get('search') || undefined;
    const status = (searchParams.get('status') as any) || undefined;
    const country = searchParams.get('country') || undefined;
    const foundedYearMin = searchParams.get('foundedYearMin') ? parseInt(searchParams.get('foundedYearMin')!, 10) : undefined;
    const foundedYearMax = searchParams.get('foundedYearMax') ? parseInt(searchParams.get('foundedYearMax')!, 10) : undefined;
    const verificationStatus = (searchParams.get('verificationStatus') as any) || undefined;
    const hasImage = searchParams.get('hasImage') === 'true' ? true : undefined;
    const hasFounder = searchParams.get('hasFounder') === 'true' ? true : undefined;
    const hasAnime = searchParams.get('hasAnime') === 'true' ? true : undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'animeCount';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    const result = await studioService.getStudios({
      q,
      status,
      country,
      foundedYearMin,
      foundedYearMax,
      verificationStatus,
      hasImage,
      hasFounder,
      hasAnime,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching studios:', error);
    return NextResponse.json({ error: 'Failed to fetch studios' }, { status: 500 });
  }
}
