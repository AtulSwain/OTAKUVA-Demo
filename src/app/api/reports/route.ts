import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { targetType, targetId, reason, description } = body;

    if (!targetType || !targetId || !reason) {
      return NextResponse.json({ error: 'Target and reason are required' }, { status: 400 });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: authUser.id,
        targetType: targetType.toUpperCase(),
        targetId,
        reason: reason.toUpperCase(),
        description: description ? description.trim() : null,
      },
    });

    return NextResponse.json({ success: true, reportId: report.id }, { status: 201 });
  } catch (error: any) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}
