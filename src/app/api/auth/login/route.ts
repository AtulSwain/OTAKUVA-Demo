import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { comparePassword, signJwtToken, syncSuperAdminBootstrap } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier?.trim() || !password) {
      return NextResponse.json({ error: 'Username/email and password are required.' }, { status: 400 });
    }

    const cleanIdentifier = identifier.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier.toLowerCase() },
          { username: cleanIdentifier },
        ],
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid username/email or password.' }, { status: 401 });
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid username/email or password.' }, { status: 401 });
    }

    const effectiveRole = await syncSuperAdminBootstrap(user.id, user.email, user.role);

    const token = signJwtToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: effectiveRole,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
    };

    const response = NextResponse.json({
      user: safeUser,
      token,
      message: 'Signed in successfully.',
    });

    response.cookies.set('anilog_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Failed to sign in.' }, { status: 500 });
  }
}
