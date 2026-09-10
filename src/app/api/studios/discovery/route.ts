import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { studioDiscoveryService } from '../../../../lib/engine/studio/studioDiscoveryService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);

    if (authUser) {
      const result = await studioDiscoveryService.getPersonalizedStudioDiscovery(authUser.id);
      return NextResponse.json(result);
    }

    const result = await studioDiscoveryService.getGuestStudioDiscovery();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching studio discovery:', error);
    return NextResponse.json({ error: 'Failed to fetch studio discovery feed' }, { status: 500 });
  }
}
