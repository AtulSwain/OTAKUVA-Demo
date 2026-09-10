import { syncAnimeCatalog } from '../src/lib/syncAnime';

async function main() {
  const res = await syncAnimeCatalog();
  console.log('Sync result:', res);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
