import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';

const endpoint =
  process.env.R2_ENDPOINT ||
  'https://0633c7571e5c9ccb6f49c6f197b707c0.r2.cloudflarestorage.com';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const bucket = process.env.R2_BUCKET_NAME || 'otakuva-media';

let client: S3Client | null = null;
if (accessKeyId && secretAccessKey) {
  client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  if (!client) {
    return new NextResponse('Storage client not configured', { status: 500 });
  }

  const pathParts = params.path;
  if (!pathParts || pathParts.length === 0) {
    return new NextResponse('Missing file key', { status: 400 });
  }

  const key = pathParts.join('/');

  // Prevent path traversal
  if (key.includes('..')) {
    return new NextResponse('Invalid file key', { status: 400 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return new NextResponse('File empty or not found', { status: 404 });
    }

    const contentType = response.ContentType || 'image/webp';
    const cacheControl = response.CacheControl || 'public, max-age=31536000, immutable';

    const webStream = response.Body.transformToWebStream();

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
    });
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return new NextResponse('File not found', { status: 404 });
    }
    console.error('Error fetching file from R2:', err);
    return new NextResponse('Error fetching file', { status: 500 });
  }
}
