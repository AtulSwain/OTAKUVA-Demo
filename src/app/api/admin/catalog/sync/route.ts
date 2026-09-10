import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { IngestionPipeline } from '@/lib/catalog/ingestionPipeline';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/catalog/sync
 * Admin endpoint to trigger targeted or batch catalog synchronization
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor or Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { mode = 'TARGETED', provider = 'anilist', externalId } = body;

    if (mode === 'TARGETED') {
      if (!externalId) {
        return NextResponse.json({ error: 'externalId is required for TARGETED sync' }, { status: 400 });
      }

      const result = await IngestionPipeline.targetedSyncAnime(provider, String(externalId));
      return NextResponse.json({
        success: result.success,
        mode: 'TARGETED',
        result,
      });
    }

    return NextResponse.json({ error: `Sync mode '${mode}' not yet implemented or invalid.` }, { status: 400 });
  } catch (error: any) {
    console.error('Catalog sync API error:', error);
    return NextResponse.json({ error: error?.message || 'Catalog sync failed' }, { status: 500 });
  }
}
