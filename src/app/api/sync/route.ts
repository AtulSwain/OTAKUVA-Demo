import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../lib/auth';
import { syncAnimeCatalog } from '../../../lib/syncAnime';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // A full catalog sync writes canonical rows, so it is a data-editor
  // action like /api/admin/sync — never something an anonymous caller can
  // trigger.
  const auth = await requireRole(request, 'DATA_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await syncAnimeCatalog();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Sync failed:', error);
    return NextResponse.json({ error: 'Failed to sync catalog' }, { status: 500 });
  }
}
