import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioKnowledgeGraphService } from '../../../../../../lib/engine/studio/studioKnowledgeGraphService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const sourceStudioId = searchParams.get('sourceId') || searchParams.get('sourceStudioId');
    const targetEntityId = searchParams.get('targetId') || searchParams.get('targetEntityId');
    const maxHops = parseInt(searchParams.get('maxHops') || '4', 10);

    if (!sourceStudioId || !targetEntityId) {
      return NextResponse.json({ error: 'sourceStudioId and targetEntityId are required' }, { status: 400 });
    }

    const path = await studioKnowledgeGraphService.findGraphPath(sourceStudioId, targetEntityId, maxHops);
    return NextResponse.json(path);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/graph/path:', error);
    return NextResponse.json({ error: error.message || 'Failed to find path' }, { status: 500 });
  }
}
