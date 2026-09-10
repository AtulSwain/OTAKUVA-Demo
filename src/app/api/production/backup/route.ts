import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { BackupManager } from '@/lib/production/backupManager';

export const dynamic = 'force-dynamic';

/**
 * POST /api/production/backup
 * Protected endpoint to generate a verified production database backup
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const backup = await BackupManager.createBackupSnapshot(100);
    const integrity = BackupManager.verifyBackupIntegrity(backup);

    return NextResponse.json({
      success: true,
      backupMetadata: backup.metadata,
      integrityCheck: integrity,
    });
  } catch (error: any) {
    console.error('Production backup API error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create backup' }, { status: 500 });
  }
}
