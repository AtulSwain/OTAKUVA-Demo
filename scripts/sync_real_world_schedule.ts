import { syncEngine } from '../src/lib/syncEngine';

async function main() {
  const result = await syncEngine.syncWeeklySchedule();
  console.log(`Real-world schedule sync: ${result.syncedCount} records synced.`);
  if (!result.success) {
    throw new Error(result.error || 'Schedule sync failed');
  }
}

main().catch((error) => {
  console.error('Schedule sync failed:', error);
  process.exitCode = 1;
});