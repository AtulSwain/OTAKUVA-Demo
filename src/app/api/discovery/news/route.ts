import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { personalizedNewsEngine } from '@/lib/engine/discovery/personalizedNewsEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/discovery/news
 * Returns personalized news dispatch with story clustering
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '15', 10);
    const category = url.searchParams.get('category') || undefined;

    const result = await personalizedNewsEngine.getPersonalizedNews(
      authUser?.id || null,
      { limit, category }
    );

    return NextResponse.json(
      {
        success: true,
        isAuthenticated: Boolean(authUser),
        ...result,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Personalized News API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch personalized news' },
      { status: 500 }
    );
  }
}
