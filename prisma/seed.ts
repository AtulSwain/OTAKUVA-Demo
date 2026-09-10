import { seedDatabase } from '../src/lib/seed';

async function main() {
  await seedDatabase();
}

main()
  .then(() => {
    console.log('Seed completed successfully.');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  });
