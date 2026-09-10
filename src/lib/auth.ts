import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { Role, hasMinRole } from './roles';

const JWT_SECRET = process.env.AUTH_SECRET || 'anilog_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = '30d';

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signJwtToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJwtToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export async function getAuthUserFromRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // 1. Check Authorization header Bearer token
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Check Cookie if no header token
    if (!token) {
      const cookie = request.cookies.get('anilog_token');
      if (cookie) {
        token = cookie.value;
      }
    }

    if (!token) {
      return null;
    }

    const payload = verifyJwtToken(token);
    if (!payload || !payload.userId) {
      return null;
    }

    // Role is always read fresh from the DB (never trusted from the JWT
    // payload) so a role change or revocation takes effect immediately,
    // without waiting for the token to expire.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, email: true, role: true },
    });

    return user;
  } catch (err) {
    return null;
  }
}

/**
 * Enforces a minimum platform role on an API route. Returns the
 * authenticated user on success, or a ready-to-return NextResponse
 * (401 if unauthenticated, 403 if the role is insufficient) on failure.
 *
 * Usage:
 *   const auth = await requireRole(request, 'DATA_EDITOR');
 *   if (auth instanceof NextResponse) return auth;
 *   // auth is AuthenticatedUser here
 */
export async function requireRole(
  request: NextRequest,
  minRole: Role
): Promise<AuthenticatedUser | NextResponse> {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  if (!hasMinRole(user.role, minRole)) {
    return NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 });
  }
  return user;
}

// Bootstraps SUPER_ADMIN access without requiring direct DB access: if the
// given email appears in OTAKUVA_SUPER_ADMIN_EMAILS (comma-separated), the
// account is promoted on login/registration. This only ever promotes —
// removing an email from the list does not demote an existing admin;
// demotion is a deliberate action via the role-management API.
// Returns the user's effective role after the check — the promoted role if
// a promotion happened, otherwise `currentRole` unchanged.
export async function syncSuperAdminBootstrap(userId: string, email: string, currentRole: string): Promise<string> {
  const list = (process.env.OTAKUVA_SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (list.length === 0) return currentRole;
  if (currentRole === 'SUPER_ADMIN') return currentRole;
  if (!list.includes(email.toLowerCase())) return currentRole;

  await prisma.user.update({ where: { id: userId }, data: { role: 'SUPER_ADMIN' } });
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: 'USER_ROLE_CHANGE',
      entityType: 'User',
      entityId: userId,
      beforeJson: JSON.stringify({ role: currentRole }),
      afterJson: JSON.stringify({ role: 'SUPER_ADMIN', via: 'OTAKUVA_SUPER_ADMIN_EMAILS bootstrap' }),
    },
  });
  return 'SUPER_ADMIN';
}
