import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { InputValidator } from '@/lib/security/inputValidation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/security/audit-logs?page=1&limit=50
 * Protected Admin Security Audit Logs
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = InputValidator.parsePagination(
      searchParams.get('page'),
      searchParams.get('limit'),
      { defaultLimit: 50, maxLimit: 100 }
    );

    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: { id: true, username: true, email: true, role: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      logs,
    });
  } catch (error: any) {
    console.error('Admin security audit logs error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
