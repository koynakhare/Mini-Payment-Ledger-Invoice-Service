import { getDb } from './connection.js';
import { oneRow } from './sqliteRows.js';
import { systemAccountService, vendorService } from '../services/index.js';

export function seedIfEmpty(): void {
  const db = getDb();

  systemAccountService.ensureCompanyBankAccount();
  systemAccountService.ensureExpenseAccount();

  const vendorCount = oneRow<{ count: number }>(db.prepare('SELECT COUNT(*) AS count FROM vendors').get());
  if ((vendorCount?.count ?? 0) > 0) {
    return;
  }

  const vendorA = vendorService.createVendor({ name: 'Raj Transport' });
  const vendorB = vendorService.createVendor({ name: 'Metro Logistics LLC', contactInfo: 'dispatch@metro.example' });

  console.log('Seeded default vendors:');
  console.log(`  ${vendorA.name}: ${vendorA.id}`);
  console.log(`  ${vendorB.name}: ${vendorB.id}`);
}

const isDirectRun = process.argv[1]?.includes('seed');
if (isDirectRun) {
  seedIfEmpty();
}
