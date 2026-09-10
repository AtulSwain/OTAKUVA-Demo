import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioAdminService } from '../../../../../../lib/engine/studio/studioAdminService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. Uploading studio images requires DATA_EDITOR or higher role.' }, { status: 403 });
    }

    const { id } = params;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const imageType = ((formData.get('imageType') as string) || 'LOGO').toUpperCase() as 'LOGO' | 'BANNER';

    if (!file) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await studioAdminService.uploadStudioImage(
      authUser.id,
      id,
      buffer,
      file.name,
      file.type || 'image/jpeg',
      imageType
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/image:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload studio image' }, { status: 400 });
  }
}
