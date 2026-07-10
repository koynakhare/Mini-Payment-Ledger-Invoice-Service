import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import {
  createVendorWithInvoice,
  gqlExpectError,
  mutateApplyPayment,
  mutateCreateInvoice,
  mutateCreateVendor,
  mutateMarkOverdue,
  mutateSendInvoice,
  resetDatabase,
  sendInvoice,
  teardownTestServer,
} from './helpers.js';

describe('invoice', () => {
  beforeEach(() => {
    resetDatabase();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('calculates invoice total as the sum of line items', async () => {
    const vendor = await mutateCreateVendor('Metro Logistics LLC');
    const result = await mutateCreateInvoice({
      vendorId: vendor.createVendor.id,
      invoiceNumber: 'INV-2026-0099',
      dueDate: '2026-09-01',
      lineItems: [
        { description: 'Fuel surcharge', quantity: 2, unitPriceCents: 4_275 },
        { description: 'Base freight', quantity: 1, unitPriceCents: 189_995 },
        { description: 'Liftgate service', quantity: 1, unitPriceCents: 12_500 },
      ],
    });

    assert.equal(result.createInvoice.totalCents, 2 * 4_275 + 189_995 + 12_500);
  });

  it('defaults new invoices to draft status', async () => {
    const vendor = await mutateCreateVendor('Raj Transport');
    const result = await mutateCreateInvoice({
      vendorId: vendor.createVendor.id,
      invoiceNumber: 'INV-2026-0042',
      dueDate: '2026-08-15',
      lineItems: [{ description: 'Detention', quantity: 3, unitPriceCents: 8_750 }],
    });

    assert.equal(result.createInvoice.status, 'draft');
  });

  it('moves a draft invoice to sent via sendInvoice', async () => {
    const { invoice } = createVendorWithInvoice({ invoiceNumber: 'INV-SEND-01' });
    assert.equal(invoice.status, 'draft');

    const sent = await mutateSendInvoice(invoice.id);
    assert.equal(sent.sendInvoice.status, 'sent');
  });

  it('rejects invoices with zero line items', async () => {
    const vendor = await mutateCreateVendor('Empty Lines Carrier');
    const message = await gqlExpectError(
      `mutation ($input: CreateInvoiceInput!) {
        createInvoice(input: $input) { id }
      }`,
      {
        input: {
          vendorId: vendor.createVendor.id,
          invoiceNumber: 'INV-EMPTY',
          dueDate: '2026-10-01',
          lineItems: [],
        },
      }
    );
    assert.match(message, /at least one line item/i);
  });

  it('flags past-due unpaid invoices as overdue via markOverdueInvoices', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-OVERDUE',
      dueDate: '2020-01-01',
      totalCents: 88_400,
    });
    sendInvoice(invoice.id);

    const result = await mutateMarkOverdue('2026-07-10');
    const updated = result.markOverdueInvoices.find((item) => item.id === invoice.id);

    assert.ok(updated);
    assert.equal(updated!.status, 'overdue');
  });

  it('does not mark an already-paid invoice as overdue', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-OVERDUE-PAID',
      dueDate: '2020-01-01',
      totalCents: 10_000,
    });
    sendInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 10_000,
      idempotencyKey: 'overdue-paid',
    });

    const result = await mutateMarkOverdue('2026-07-10');
    const match = result.markOverdueInvoices.find((item) => item.id === invoice.id);
    assert.equal(match, undefined);
  });
});
