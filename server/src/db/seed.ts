import { queryOne } from './connection.js';
import { systemAccountService, vendorService } from '../services/index.js';

export async function seedIfEmpty(): Promise<void> {
  await systemAccountService.ensureCompanyBankAccount();
  await systemAccountService.ensureExpenseAccount();

  const vendorCount = await queryOne<{ count: number }>(
    'SELECT COUNT(*) AS count FROM vendors'
  );
  if ((vendorCount?.count ?? 0) > 0) {
    return;
  }

  const vendorA = await vendorService.createVendor({ name: 'Raj Transport' });
  const vendorB = await vendorService.createVendor({
    name: 'Metro Logistics LLC',
    contactInfo: 'dispatch@metro.example',
  });

  console.log('Seeded default vendors:');
  console.log(`  ${vendorA.name}: ${vendorA.id}`);
  console.log(`  ${vendorB.name}: ${vendorB.id}`);
}

const isDirectRun = process.argv[1]?.includes('seed');
if (isDirectRun) {
  seedIfEmpty()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
