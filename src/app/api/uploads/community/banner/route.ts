import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { getStorageProvider, MAX_BANNER_SIZE_BYTES } from '../../../../../lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to upload a banner.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const communityId = formData.get('communityId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    // Check size upfront
    if (file.size > MAX_BANNER_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image is too large. Maximum allowed size for banners is 15 MB.' }, { status: 400 });
    }

    // If communityId provided, verify owner/moderator authorization
    if (communityId) {
      const community = await prisma.community.findUnique({
        where: { id: communityId },
        include: { members: { where: { userId: authUser.id } } },
      });

      if (!community) {
        return NextResponse.json({ error: 'Community not found.' }, { status: 404 });
      }

      const isOwner = community.ownerId === authUser.id;
      const isMod = community.members.some((m) => m.role === 'MODERATOR' && m.status === 'ACTIVE');

      if (!isOwner && !isMod) {
        return NextResponse.json({ error: 'Unauthorized. Only community owners and moderators can modify branding.' }, { status: 403 });
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storage = getStorageProvider();
    const uploadResult = await storage.upload({
      file: buffer,
      filename: file.name,
      mimeType: file.type || 'image/jpeg',
      category: 'community-banner',
      entityId: communityId || authUser.id,
      maxSizeBytes: MAX_BANNER_SIZE_BYTES,
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      source: 'UPLOAD',
      filename: uploadResult.filename,
      size: uploadResult.size,
      mimeType: uploadResult.mimeType,
    });
  } catch (error: any) {
    console.error('Error uploading community banner:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload banner.' }, { status: 500 });
  }
}
