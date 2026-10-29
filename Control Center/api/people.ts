import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';
import { controlError, NO_STORE, pageParams } from '@control/lib/http';

type Row = { id: string; slug: string | null; name: string; nativeName: string | null; imageUrl: string | null; credits: bigint; voices: bigint; total: bigint };

/**
 * GET /api/control/people?q=&missing=photo&page= — creators, directors and
 * voice actors, the best-known first. ADMIN+.
 */
export async function GET(request: NextRequest) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sp = request.nextUrl.searchParams;
    const { page, limit, skip } = pageParams(sp);
    const q = (sp.get('q') || '').trim().slice(0, 80);
    const conds: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (q) conds.push(Prisma.sql`(p.name ILIKE ${`%${q}%`} OR p."nativeName" ILIKE ${`%${q}%`})`);
    if (sp.get('missing') === 'photo') conds.push(Prisma.sql`(p."imageUrl" IS NULL OR p."imageUrl" = '')`);
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT p.id, p.slug, p.name, p."nativeName", p."imageUrl",
             (SELECT COUNT(*) FROM "AnimeStaff" s WHERE s."personId" = p.id) AS credits,
             (SELECT COUNT(*) FROM "CharacterVoiceActor" v WHERE v."personId" = p.id) AS voices,
             COUNT(*) OVER () AS total
      FROM "Person" p
      WHERE ${Prisma.join(conds, ' AND ')}
      ORDER BY COALESCE(p."anilistFavourites", 0) DESC, p.name ASC
      LIMIT ${limit} OFFSET ${skip}`;
    return NextResponse.json(
      {
        total: Number(rows[0]?.total ?? 0),
        page,
        people: rows.map(({ total: _t, credits, voices, ...r }) => ({ ...r, credits: Number(credits), voiceRoles: Number(voices) })),
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return controlError(e, '/api/control/people');
  }
}
