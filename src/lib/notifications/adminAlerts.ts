/**
 * Alerts for the platform's admins (2026-10-28, owner: "when a creator joins I
 * get a notification"). Sent to every ADMIN / SUPER_ADMIN account as a normal
 * Notification (bell + control center). Best-effort: never blocks the action.
 */
import { prisma } from '../prisma';

export async function alertAdmins(type: 'ADMIN_NEW_MEMBER' | 'ADMIN_NEW_CREATOR', title: string, body: string, linkUrl: string) {
  try {
    const admins = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }, select: { id: true } });
    if (!admins.length) return;
    await prisma.notification.createMany({ data: admins.map((a) => ({ userId: a.id, type, title, body, linkUrl })) });
  } catch {
    /* alerts must never break sign-up */
  }
}
