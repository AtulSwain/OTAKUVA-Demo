import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { requireRole } from '../../../../../../lib/auth';
import { ROLES, isValidRole } from '../../../../../../lib/roles';

export const dynamic = 'force-dynamic';

// Changes a user's platform role. SUPER_ADMIN only — this is the sole way
// roles change outside the OTAKUVA_SUPER_ADMIN_EMAILS bootstrap. Every
// change is written to AuditLog with the before/after value and the actor.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, 'SUPER_ADMIN');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const nextRole = body?.role;

    if (!isValidRole(nextRole)) {
      return NextResponse.json(
        { error: `role must be one of: ${ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, username: true, role: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Guard against locking the platform out of SUPER_ADMIN entirely by
    // demoting the last remaining super admin (including demoting self).
    if (target.role === 'SUPER_ADMIN' && nextRole !== 'SUPER_ADMIN') {
      const remainingSuperAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
      if (remainingSuperAdmins <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last SUPER_ADMIN. Promote another user first.' },
          { status: 409 }
        );
      }
    }

    if (target.role === nextRole) {
      return NextResponse.json({ user: target, changed: false });
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: nextRole },
      select: { id: true, username: true, email: true, role: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.id,
        action: 'USER_ROLE_CHANGE',
        entityType: 'User',
        entityId: target.id,
        beforeJson: JSON.stringify({ role: target.role }),
        afterJson: JSON.stringify({ role: nextRole }),
      },
    });

    return NextResponse.json({ user: updated, changed: true });
  } catch (error: any) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}
