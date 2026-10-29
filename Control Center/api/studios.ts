import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';
import { controlError, NO_STORE, pageParams } from '@control/lib/http';

type Row = { id: string; slug: string | null; name: string; logoUrl: string | null; foundedYear: number | null; works: bigint; total: bigint };

/** GET /api/control/studios?q=&missing=logo&page= — studios, most works first. ADMIN+. */
export async function GET(request: NextRequest) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sp = request.nextUrl.searchParams;
    const { page, limit, skip } = pageParams(sp);
    const q = (sp.get('q') || '').trim().slice(0, 80);
    const conds: Prisma.Sql[] = [Prisma.sql`s.status <> 'MERGED'`];
    if (q) conds.push(Prisma.sql`(s.name ILIKE ${`%${q}%`} OR s."nativeName" ILIKE ${`%${q}%`})`);
    if (sp.get('missing') === 'logo') conds.push(Prisma.sql`COALESCE(s."adminOverrideImageUrl", s."imageUrl") IS NULL`);
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT s.id, s.slug, s.name, COALESCE(s."adminOverrideImageUrl", s."imageUrl") AS "logoUrl",
             COALESCE(s."adminOverrideFoundedYear", s."foundedYear") AS "foundedYear",
             (SELECT COUNT(*) FROM "AnimeStudio" x WHERE x."studioId" = s.id) AS works,
             COUNT(*) OVER () AS total
      FROM "Studio" s
      WHERE ${Prisma.join(conds, ' AND ')}
      ORDER BY works DESC, s.name ASC
      LIMIT ${limit} OFFSET ${skip}`;
    return NextResponse.json(
      { total: Number(rows[0]?.total ?? 0), page, studios: rows.map(({ total: _t, works, ...r }) => ({ ...r, works: Number(works) })) },
      { headers: NO_STORE },
    );
  } catch (e) {
    return controlError(e, '/api/control/studios');
  }
}
