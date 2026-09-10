import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { studioDashboardService } from '../../../../../lib/engine/studio/studioDashboardService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const authUser = await getAuthUserFromRequest(req).catch(() => null);

    const dashboard = await studioDashboardService.getStudioDashboard(
      slug,
      authUser?.id || null
    );

    if (!dashboard) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json({ dashboard });
  } catch (error: any) {
    console.error('Error in GET /api/studios/[slug]/dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch studio dashboard' },
      { status: 500 }
    );
  }
}
