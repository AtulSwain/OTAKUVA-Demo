import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const clusters = await prisma.newsStoryCluster.findMany({
      include: {
        articles: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            adminOverrideTitle: true,
            sourceName: true,
            sourceUrl: true,
            provider: true,
            publishedAt: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ clusters });
  } catch (error: any) {
    console.error('Error fetching duplicate clusters:', error);
    return NextResponse.json({ error: 'Failed to fetch duplicates' }, { status: 500 });
  }
}
