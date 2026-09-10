import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { studioDiscoveryService } from '../../../../../lib/engine/studio/studioDiscoveryService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ personalization: null });
    }

    const { slug } = params;
    const personalization = await studioDiscoveryService.getStudioUserPersonalization(authUser.id, slug);

    return NextResponse.json({ personalization });
  } catch (error: any) {
    console.error('Error fetching studio personalization:', error);
    return NextResponse.json({ error: 'Failed to fetch studio personalization' }, { status: 500 });
  }
}
