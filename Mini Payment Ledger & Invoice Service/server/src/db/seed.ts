import { getDb } from './connection.js';
import { oneRow } from './sqliteRows.js';
import { systemAccountService, vendorService } from '../services/index.js';

export function seed(): void {
  const db = getDb();

  systemAccountService.ensureCompanyBankAccount();
  systemAccountService.ensureExpenseAccount();

  const vendorCount = oneRow<{ count: number }>(db.prepare('SELECT COUNT(*) AS count FROM vendors').get());
  if ((vendorCount?.count ?? 0) > 0) {
    console.log('Database already seeded with vendors, skipping vendor seed.');
    return;
  }

  const vendorA = vendorService.createVendor({ name: 'Raj Transport' });
  const vendorB = vendorService.createVendor({ name: 'Metro Logistics LLC', contactInfo: 'dispatch@metro.example' });

  console.log('Seeded vendors:');
  console.log(`  ${vendorA.name}: ${vendorA.id}`);
  console.log(`  ${vendorB.name}: ${vendorB.id}`);
}

seed();
