import { NextRequest, NextResponse } from 'next/server';
import { requireControl } from '@control/lib/access';
import { setPersonPhoto } from '@control/lib/editor';
import { refreshSite } from '@control/lib/publish';
import { controlError, NO_STORE } from '@control/lib/http';

/** PATCH /api/control/people/:id { imageUrl } — set (or clear with null) a creator's photo. ADMIN+. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await setPersonPhoto(params.id, body?.imageUrl, auth.id);
    refreshSite();
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    return controlError(e, '/api/control/people/[id]');
  }
}
