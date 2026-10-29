import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';
import { generateRawToken, hashToken, PASSWORD_RESET_TOKEN_TTL_MS } from '@/lib/security/tokens';
import { sendEmail } from '@/lib/email/emailSender';

export const dynamic = 'force-dynamic';

const mask = (email: string | null) => {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return null;
  return `${local.slice(0, 2)}${local.length > 2 ? '•••' : ''}@${domain}`;
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, username: true, displayName: true, email: true, phone: true, passwordHash: true, passwordChangedAt: true, lastLoginAt: true, lastSeenAt: true, createdAt: true, role: true } });
  if (!user || user.role !== 'CREATOR') return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
  return NextResponse.json({ creator: { ...user, email: mask(user.email), hasPassword: Boolean(user.passwordHash), passwordHash: undefined } });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, username: true, email: true, role: true } });
  if (!user || user.role !== 'CREATOR') return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
  if (!user.email) return NextResponse.json({ error: 'This creator has no email on file. Use the verified phone recovery flow.' }, { status: 400 });
  const rawToken = generateRawToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS) } }),
    prisma.auditLog.create({ data: { actorId: auth.id, action: 'ADMIN_PASSWORD_RESET_REQUEST', entityType: 'User', entityId: user.id, afterJson: JSON.stringify({ username: user.username, delivery: 'email', expiresInMinutes: 60 }) } }),
  ]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  await sendEmail({ to: user.email, subject: 'Reset your OTAKUVA password', text: `Hi ${user.username},\n\nAn administrator requested a secure password reset for your OTAKUVA account. Use this one-time link within 1 hour:\n\n${appUrl}/reset-password?token=${rawToken}\n\nIf you did not request this, contact OTAKUVA support.` });
  return NextResponse.json({ message: 'A one-time reset link was sent to the masked email on file.' });
}
