import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { DataQualityEngine } from '@/lib/catalog/dataQualityEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/catalog/quality
 * Admin endpoint returning catalog data quality metrics and orphan reports
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor or Admin access required' }, { status: 403 });
    }

    const report = await DataQualityEngine.generateQualityReport();
    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Catalog quality API error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch catalog quality report' }, { status: 500 });
  }
}
