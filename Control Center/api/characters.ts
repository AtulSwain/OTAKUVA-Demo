import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';
import { controlError, NO_STORE, pageParams } from '@control/lib/http';

type Row = { id: string; slug: string | null; name: string; imageUrl: string | null; anime: string | null; members: number | null; total: bigint };

/** GET /api/control/characters?q=&missing=image&page= — characters with the anime they're best known from. ADMIN+. */
export async function GET(request: NextRequest) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sp = request.nextUrl.searchParams;
    const { page, limit, skip } = pageParams(sp);
    const q = (sp.get('q') || '').trim().slice(0, 80);
    const conds: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (q) conds.push(Prisma.sql`c.name ILIKE ${`%${q}%`}`);
    if (sp.get('missing') === 'image') conds.push(Prisma.sql`(c."imageUrl" IS NULL OR c."imageUrl" = '')`);
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT c.id, c.slug, c.name, c."imageUrl", top.title AS anime, top.members, COUNT(*) OVER () AS total
      FROM "Character" c
      LEFT JOIN LATERAL (
        SELECT a."canonicalTitle" AS title, a.members
        FROM "AnimeCharacter" ac JOIN "Anime" a ON a.id = ac."animeId"
        WHERE ac."characterId" = c.id
        ORDER BY a.members DESC NULLS LAST
        LIMIT 1
      ) top ON TRUE
      WHERE ${Prisma.join(conds, ' AND ')}
      ORDER BY top.members DESC NULLS LAST, c.name ASC
      LIMIT ${limit} OFFSET ${skip}`;
    return NextResponse.json({ total: Number(rows[0]?.total ?? 0), page, characters: rows.map(({ total: _t, ...r }) => r) }, { headers: NO_STORE });
  } catch (e) {
    return controlError(e, '/api/control/characters');
  }
}
