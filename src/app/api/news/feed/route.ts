import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { newsPersonalizationService } from '../../../../lib/engine/news/newsPersonalizationService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const category = searchParams.get('category') || undefined;

    const result = await newsPersonalizationService.getPersonalizedFeed(authUser?.id, {
      cursor,
      limit,
      category,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error generating personalized news feed:', error);
    return NextResponse.json({ error: 'Failed to generate personalized feed' }, { status: 500 });
  }
}
