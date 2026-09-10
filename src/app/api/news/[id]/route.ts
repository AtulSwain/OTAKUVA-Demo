import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { newsEngine } from '../../../../lib/engine/news/newsEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await newsEngine.getNewsById(params.id);
    if (!article) {
      return NextResponse.json({ error: 'News article not found' }, { status: 404 });
    }

    // Return both wrapped article and top-level fields for total backward compatibility
    return NextResponse.json({ article, ...article });
  } catch (error: any) {
    console.error('Error fetching article:', error);
    return NextResponse.json({ error: 'Failed to fetch news article' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const updated = await newsEngine.applyAdminOverride(authUser.id, params.id, body);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error applying admin override:', error);
    return NextResponse.json({ error: error.message || 'Failed to update news article' }, { status: 500 });
  }
}
