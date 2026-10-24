import { NextRequest, NextResponse } from 'next/server';
import { getBrowseList } from '../../../lib/browseService';
import { parseBrowseParams } from '../../../lib/browse';

export const dynamic = 'force-dynamic';

/**
 * GET /api/browse?tab=viewed|rated|choice|monthly|awards&genre=&format=&country=&family=1
 * Every parameter is checked against an allowlist; anything else is ignored.
 */
export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
    const { tab, ...filters } = parseBrowseParams(raw);
    const limit = parseInt(raw.limit || '', 10);
    const items = await getBrowseList(tab, filters, Number.isFinite(limit) && limit > 0 ? limit : undefined);
    return NextResponse.json({ tab, filters, items }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (error) {
    console.error('Error loading browse list:', error);
    return NextResponse.json({ error: 'Failed to load this list' }, { status: 500 });
  }
}
