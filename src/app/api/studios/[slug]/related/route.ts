import { NextRequest, NextResponse } from 'next/server';
import { studioDiscoveryService } from '../../../../../lib/engine/studio/studioDiscoveryService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '6', 10);

    const related = await studioDiscoveryService.getSimilarStudios(slug, limit);
    return NextResponse.json({ related });
  } catch (error: any) {
    console.error('Error fetching related studios:', error);
    return NextResponse.json({ error: 'Failed to fetch related studios' }, { status: 500 });
  }
}
