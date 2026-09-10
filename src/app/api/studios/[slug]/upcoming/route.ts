import { NextRequest, NextResponse } from 'next/server';
import { studioProjectService } from '../../../../../lib/engine/studio/studioProjectService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const upcoming = await studioProjectService.getStudioUpcomingProjects(slug);
    return NextResponse.json({ upcoming });
  } catch (error: any) {
    console.error('Error in GET /api/studios/[slug]/upcoming:', error);
    return NextResponse.json({ error: 'Failed to fetch upcoming projects' }, { status: 500 });
  }
}
