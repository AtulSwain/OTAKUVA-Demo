import { NextRequest, NextResponse } from 'next/server';
import { embeddingEngine } from '@/lib/engine/ai/embeddingEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/intelligence/semantic-search?q=...&limit=10
 * Performs semantic vector search over Anime catalog
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const minSimilarity = parseFloat(url.searchParams.get('minSimilarity') || '0.25');

    if (!query.trim()) {
      return NextResponse.json({ error: 'Search query "q" is required.' }, { status: 400 });
    }

    const searchResults = await embeddingEngine.searchSemantically(query, {
      limit,
      minSimilarity,
    });

    return NextResponse.json(
      {
        success: true,
        ...searchResults,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Semantic search API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to execute semantic vector search.' },
      { status: 500 }
    );
  }
}
