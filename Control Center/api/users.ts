import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';
import { controlError, NO_STORE, pageParams } from '@control/lib/http';
import { isValidRole } from '@/lib/roles';

type Row = {
  id: string; username: string; displayName: string | null; role: string; createdAt: Date;
  lastSeenAt: Date | null; lastLoginAt: Date | null; phoneVerified: boolean; hasPassword: boolean;
  avatarUrl: string | null; creatorChannelName: string | null; reviews: bigint; ratings: bigint; total: bigint;
};

/**
 * GET /api/control/users?q=&role=&sort=recent|active|name&page=
 * Members with sign-up date, last seen, verification and activity counts.
 * Never returns phone numbers, emails or password data. ADMIN+.
 */
export async function GET(request: NextRequest) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sp = request.nextUrl.searchParams;
    const { page, limit, skip } = pageParams(sp);
    const q = (sp.get('q') || '').trim().slice(0, 60);
    const role = sp.get('role') || '';
    const sort = sp.get('sort') || 'recent';
    const conds: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (q) conds.push(Prisma.sql`(u.username ILIKE ${'%' + q + '%'} OR u."displayName" ILIKE ${'%' + q + '%'})`);
    if (role && isValidRole(role)) conds.push(Prisma.sql`u.role = ${role}`);
    if (sort === 'active') conds.push(Prisma.sql`u."lastSeenAt" IS NOT NULL`);
    const order =
      sort === 'active' ? Prisma.sql`u."lastSeenAt" DESC NULLS LAST` : sort === 'name' ? Prisma.sql`lower(u.username) ASC` : Prisma.sql`u."createdAt" DESC`;
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT u.id, u.username, u."displayName", u.role, u."createdAt", u."lastSeenAt", u."lastLoginAt",
             (u."phoneVerifiedAt" IS NOT NULL) AS "phoneVerified", (u."passwordHash" IS NOT NULL) AS "hasPassword",
             u."avatarUrl", u."creatorChannelName",
             (SELECT COUNT(*) FROM "Review" r WHERE r."userId" = u.id AND r."deletedAt" IS NULL) AS reviews,
             (SELECT COUNT(DISTINCT e."animeId") FROM "EpisodeRating" e WHERE e."userId" = u.id) AS ratings,
             COUNT(*) OVER () AS total
      FROM "User" u
      WHERE ${Prisma.join(conds, ' AND ')}
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${skip}`;
    return NextResponse.json(
      {
        total: Number(rows[0]?.total ?? 0),
        page,
        canChangeRoles: auth.role === 'SUPER_ADMIN',
        users: rows.map(({ total: _t, reviews, ratings, ...r }) => ({ ...r, reviews: Number(reviews), ratedAnime: Number(ratings) })),
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return controlError(e, '/api/control/users');
  }
}
