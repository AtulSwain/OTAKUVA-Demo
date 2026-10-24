import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { deleteList, getListForOwner, ListError, updateList } from '../../../../lib/lists/listService';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

function fail(error: unknown, action: string) {
  if (error instanceof ListError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  console.error(`Error trying to ${action} list:`, error);
  return NextResponse.json({ error: `Failed to ${action} list` }, { status: 500 });
}

/** GET /api/lists/:id — the owner's view. Shared lists are read via /l/<token>. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const list = await getListForOwner(authUser.id, params.id);
    if (!list) return NextResponse.json({ error: 'List not found.' }, { status: 404 });
    return NextResponse.json({ list });
  } catch (e) {
    return fail(e, 'load');
  }
}

/** PATCH /api/lists/:id { name?, description?, visibility?, regenerateLink? } */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const list = await updateList(authUser.id, params.id, body ?? {});
    return NextResponse.json({ list });
  } catch (e) {
    return fail(e, 'update');
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    await deleteList(authUser.id, params.id);
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return fail(e, 'delete');
  }
}
