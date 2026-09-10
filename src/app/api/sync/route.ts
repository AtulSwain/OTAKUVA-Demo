import { NextResponse } from 'next/server';
import { syncAnimeCatalog } from '../../../lib/syncAnime';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await syncAnimeCatalog();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Sync failed:', error);
    return NextResponse.json({ error: 'Failed to sync catalog' }, { status: 500 });
  }
}
