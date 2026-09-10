import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { studioDeduplicationService } from '@/lib/engine/studio/studioDeduplicationService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studioId = searchParams.get('studioId');

    if (!studioId) {
      return NextResponse.json({ error: 'studioId is required' }, { status: 400 });
    }

    const aliases = await prisma.studioAlias.findMany({
      where: { studioId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, aliases });
  } catch (error) {
    console.error('Error fetching studio aliases:', error);
    return NextResponse.json({ error: 'Failed to fetch studio aliases' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor access required' }, { status: 403 });
    }

    const body = await req.json();
    const { studioId, alias, aliasType = 'ALTERNATIVE', language = 'en' } = body;

    if (!studioId || !alias) {
      return NextResponse.json({ error: 'studioId and alias are required' }, { status: 400 });
    }

    const norm = studioDeduplicationService.normalizeStudioName(alias);
    if (!norm) {
      return NextResponse.json({ error: 'Alias resolves to empty normalized string' }, { status: 400 });
    }

    const created = await prisma.studioAlias.upsert({
      where: { studioId_normalizedAlias: { studioId, normalizedAlias: norm } },
      create: {
        studioId,
        alias,
        normalizedAlias: norm,
        aliasType,
        language,
        source: 'ADMIN_MANUAL',
        verified: true,
      },
      update: {
        alias,
        aliasType,
        language,
        verified: true,
      },
    });

    return NextResponse.json({ success: true, alias: created });
  } catch (error) {
    console.error('Error creating studio alias:', error);
    return NextResponse.json({ error: 'Failed to create studio alias' }, { status: 500 });
  }
}
