import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../lib/auth';
import { newsEngine } from '../../../../../lib/engine/news/newsEngine';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const [providers, jobs] = await Promise.all([
      prisma.newsProvider.findMany({ orderBy: { updatedAt: 'desc' } }),
      prisma.newsIngestionJob.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
    ]);

    return NextResponse.json({ providers, jobs });
  } catch (error: any) {
    console.error('Error fetching provider sync status:', error);
    return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const { providerSlug = 'all' } = body;

    // This used to always sync 'ann' regardless of the requested
    // providerSlug (crunchyroll/official could never be triggered from
    // here) — now actually respects it, with 'all' running every
    // registered adapter (ann, crunchyroll, official).
    const result = providerSlug === 'all'
      ? await newsEngine.syncAllProviders()
      : await newsEngine.syncProvider(providerSlug);

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: 'NEWS_MANUAL_SYNC_TRIGGERED',
        entityType: 'NEWS_PROVIDER',
        entityId: providerSlug,
        afterJson: JSON.stringify({ result }),
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error triggering manual sync:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
