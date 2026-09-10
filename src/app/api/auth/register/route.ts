import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { hashPassword, signJwtToken, syncSuperAdminBootstrap } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    if (!username?.trim() || !email?.trim() || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Valid username, email, and password (at least 6 characters) are required.' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check if username or email already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: cleanUsername }, { email: cleanEmail }],
      },
    });

    if (existing) {
      if (existing.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Email is already registered.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanUsername)}`,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    });

    const effectiveRole = await syncSuperAdminBootstrap(user.id, user.email, user.role);

    const token = signJwtToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const response = NextResponse.json({
      user: { ...user, role: effectiveRole },
      token,
      message: 'Account created successfully.',
    });

    // Set httpOnly cookie
    response.cookies.set('anilog_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 });
  }
}
