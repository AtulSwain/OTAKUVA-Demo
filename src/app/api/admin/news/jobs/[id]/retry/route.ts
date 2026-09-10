import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../../../lib/auth';
import { annNewsAdapter } from '../../../../../../../lib/engine/news/adapters/annNewsAdapter';
import { newsIngestionService } from '../../../../../../../lib/engine/news/newsIngestionService';
import { prisma } from '../../../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  try {
    const job = await prisma.newsIngestionJob.findUnique({ where: { id: params.id } });
    if (!job) {
      return NextResponse.json({ error: 'Ingestion job not found' }, { status: 404 });
    }

    // Trigger retry
    const result = await newsIngestionService.ingestFromProvider(annNewsAdapter);

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: 'NEWS_INGESTION_JOB_RETRIED',
        entityType: 'NEWS_INGESTION_JOB',
        entityId: params.id,
        afterJson: JSON.stringify({ result }),
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error retrying ingestion job:', error);
    return NextResponse.json({ error: error.message || 'Retry failed' }, { status: 500 });
  }
}
