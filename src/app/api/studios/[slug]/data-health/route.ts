import { NextRequest, NextResponse } from 'next/server';
import { studioDataIntelligenceService } from '../../../../../lib/engine/studio/studioDataIntelligenceService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const report = await studioDataIntelligenceService.getStudioHealthReport(slug);

    if (!report) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    // Public view provides clean score, checks, and verification state (hiding internal raw duplicate IDs)
    return NextResponse.json({
      studioId: report.studioId,
      studioName: report.studioName,
      completenessScore: report.completenessScore,
      healthTier: report.healthTier,
      verificationStatus: report.verificationStatus,
      checks: report.checks,
      missingElements: report.missingElements,
    });
  } catch (error: any) {
    console.error('Error in GET /api/studios/[slug]/data-health:', error);
    return NextResponse.json({ error: 'Failed to fetch studio data health' }, { status: 500 });
  }
}
