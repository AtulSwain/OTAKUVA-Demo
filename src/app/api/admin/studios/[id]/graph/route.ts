import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioKnowledgeGraphService } from '../../../../../../lib/engine/studio/studioKnowledgeGraphService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const depth = parseInt(searchParams.get('depth') || '2', 10);
    const maxNodes = parseInt(searchParams.get('maxNodes') || '80', 10);

    const graph = await studioKnowledgeGraphService.getStudioKnowledgeGraph(id, {
      depth,
      maxNodes,
      includeNews: true,
      includeCommunities: true,
    });

    if (!graph) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json({ graph });
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/graph:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch graph' }, { status: 500 });
  }
}
