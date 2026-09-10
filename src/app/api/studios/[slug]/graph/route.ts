import { NextRequest, NextResponse } from 'next/server';
import { studioKnowledgeGraphService } from '../../../../../lib/engine/studio/studioKnowledgeGraphService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(req.url);
    const depth = parseInt(searchParams.get('depth') || '2', 10);
    const maxNodes = parseInt(searchParams.get('maxNodes') || '50', 10);

    const graph = await studioKnowledgeGraphService.getStudioKnowledgeGraph(slug, {
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
    console.error('Error in GET /api/studios/[slug]/graph:', error);
    return NextResponse.json({ error: 'Failed to fetch studio knowledge graph' }, { status: 500 });
  }
}
