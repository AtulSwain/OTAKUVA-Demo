import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logger';
import { queryStudioDirectory, type DirectorySort, type DirectoryStatus } from '../../../../lib/studios/studioDirectory';

export const dynamic = 'force-dynamic';

const SORTS: DirectorySort[] = ['works', 'name', 'oldest', 'newest', 'active'];
const STATUSES: DirectoryStatus[] = ['all', 'active', 'closed'];

/** GET /api/studios/directory?q=&sort=&status=&offset=&limit= — one page of the /studios directory. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const sort = SORTS.includes(sp.get('sort') as DirectorySort) ? (sp.get('sort') as DirectorySort) : 'works';
  const status = STATUSES.includes(sp.get('status') as DirectoryStatus) ? (sp.get('status') as DirectoryStatus) : 'all';
  const q = (sp.get('q') || '').slice(0, 80);
  const offset = Number.parseInt(sp.get('offset') || '0', 10) || 0;
  const limit = Number.parseInt(sp.get('limit') || '48', 10) || 48;
  try {
    const result = await queryStudioDirectory({ q, sort, status, offset, limit });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (e) {
    logger.error('Studio directory failed', { error: e, route: '/api/studios/directory', method: 'GET' });
    return NextResponse.json({ error: 'Failed to load studios' }, { status: 500 });
  }
}
