import { invoiceService } from '../services/index.js';

const asOfDate = process.argv[2];

async function main(): Promise<void> {
  const updated = invoiceService.markOverdueInvoices(asOfDate);
  console.log(`Marked ${updated.length} invoice(s) as overdue.`);
  for (const invoice of updated) {
    console.log(`  - ${invoice.invoiceNumber} (${invoice.id})`);
  }
}

main().catch((error) => {
  console.error('Overdue job failed:', error);
  process.exit(1);
});
