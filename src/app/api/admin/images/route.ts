import { NextRequest, NextResponse } from 'next/server';
import { ImageHealthService } from '../../../../lib/engine/media/imageHealthService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const metrics = await ImageHealthService.scanCatalogImages();
    return NextResponse.json({ success: true, data: metrics });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'repair';

    if (action === 'scan') {
      const metrics = await ImageHealthService.scanCatalogImages();
      return NextResponse.json({ success: true, data: metrics });
    }

    if (action === 'repair') {
      const res = await ImageHealthService.repairCatalogImages();
      const metrics = ImageHealthService.getHealthSummary();
      return NextResponse.json({ success: true, repaired: res.repaired, failed: res.failed, data: metrics });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
