import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { studioCreatorDiscoveryEngine } from '@/lib/engine/discovery/studioCreatorDiscoveryEngine';
import { studioDiscoveryService } from '@/lib/engine/studio/studioDiscoveryService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/discovery/studios
 * Returns Studio and Creator discovery catalog
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const studioSlug = url.searchParams.get('studio');

    if (studioSlug) {
      // Specific Studio Catalog Discovery
      const catalog = await studioCreatorDiscoveryEngine.getStudioCatalogDiscovery(
        studioSlug,
        authUser?.id || null
      );
      if (!catalog) {
        return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, ...catalog });
    }

    // General Studio & Creator Discovery
    if (authUser) {
      const [studioDiscovery, creators] = await Promise.all([
        studioDiscoveryService.getPersonalizedStudioDiscovery(authUser.id),
        studioCreatorDiscoveryEngine.getPersonalizedCreatorDiscovery(authUser.id, 6),
      ]);
      return NextResponse.json({
        success: true,
        isAuthenticated: true,
        ...studioDiscovery,
        creatorsYouMayLike: creators,
      });
    }

    const guestDiscovery = await studioDiscoveryService.getGuestStudioDiscovery();
    return NextResponse.json({
      success: true,
      isAuthenticated: false,
      ...guestDiscovery,
    });
  } catch (error: any) {
    console.error('Studio Discovery API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch studio discovery' },
      { status: 500 }
    );
  }
}
