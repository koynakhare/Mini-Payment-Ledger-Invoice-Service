import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import {
  resetEmailClient,
  setEmailClient,
  type EmailClient,
  type SendEmailOptions,
} from '../email/index.js';
import { invoiceService } from '../services/index.js';
import {
  createVendorWithInvoice,
  gqlExpectError,
  mutateApplyPayment,
  mutateCreateInvoice,
  mutateCreateVendor,
  mutateMarkOverdue,
  mutateSendInvoice,
  ensureApproverAuth,
  resetDatabase,
  sendInvoice,
  teardownTestServer,
} from './helpers.js';

describe('invoice', () => {
  beforeEach(async () => {
    await resetDatabase();
    await ensureApproverAuth();
    resetEmailClient();
  });

  after(async () => {
    resetEmailClient();
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
    const { invoice } = await createVendorWithInvoice({ invoiceNumber: 'INV-SEND-01' });
    assert.equal(invoice.status, 'draft');

    const sent = await mutateSendInvoice(invoice.id);
    assert.equal(sent.sendInvoice.status, 'sent');
  });

  it('emails the vendor a PDF when sending an invoice', async () => {
    const sentMail: SendEmailOptions[] = [];
    const mock: EmailClient = {
      async send(options) {
        sentMail.push(options);
      },
    };
    setEmailClient(mock);

    const { invoice } = await createVendorWithInvoice({ invoiceNumber: 'INV-SEND-PDF' });
    await mutateSendInvoice(invoice.id, 'billing@vendor.example');

    assert.equal(sentMail.length, 1);
    assert.equal(sentMail[0].to, 'billing@vendor.example');
    assert.match(sentMail[0].subject, /INV-SEND-PDF/);
    assert.equal(sentMail[0].attachments?.length, 1);
    assert.equal(sentMail[0].attachments?.[0].contentType, 'application/pdf');
    assert.ok((sentMail[0].attachments?.[0].content.length ?? 0) > 100);
  });

  it('keeps the invoice as draft when email delivery fails', async () => {
    setEmailClient({
      async send() {
        throw new Error('SMTP down');
      },
    });

    const { invoice } = await createVendorWithInvoice({ invoiceNumber: 'INV-SEND-FAIL' });
    const message = await gqlExpectError(
      `mutation ($invoiceId: ID!, $vendorEmail: String!) {
        sendInvoice(invoiceId: $invoiceId, vendorEmail: $vendorEmail) { id status }
      }`,
      { invoiceId: invoice.id, vendorEmail: 'billing@vendor.example' }
    );
    assert.match(message, /SMTP down|Failed to send|unexpected/i);

    const reloaded = await invoiceService.getInvoice(invoice.id);
    assert.equal(reloaded.status, 'draft');
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

  it('rejects a duplicate invoice number with a clear conflict message', async () => {
    const vendor = await mutateCreateVendor('Duplicate Number Carrier');
    await mutateCreateInvoice({
      vendorId: vendor.createVendor.id,
      invoiceNumber: 'INV-DUP-01',
      dueDate: '2026-10-01',
      lineItems: [{ description: 'Haul', quantity: 1, unitPriceCents: 1000 }],
    });

    const message = await gqlExpectError(
      `mutation ($input: CreateInvoiceInput!) {
        createInvoice(input: $input) { id }
      }`,
      {
        input: {
          vendorId: vendor.createVendor.id,
          invoiceNumber: 'INV-DUP-01',
          dueDate: '2026-10-02',
          lineItems: [{ description: 'Haul 2', quantity: 1, unitPriceCents: 2000 }],
        },
      }
    );
    assert.match(message, /already exists/i);
  });

  it('flags past-due unpaid invoices as overdue via markOverdueInvoices', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-OVERDUE',
      dueDate: '2020-01-01',
      totalCents: 88_400,
    });
    await sendInvoice(invoice.id);

    const result = await mutateMarkOverdue('2026-07-10');
    const updated = result.markOverdueInvoices.find((item) => item.id === invoice.id);

    assert.ok(updated);
    assert.equal(updated!.status, 'overdue');
  });

  it('does not mark an already-paid invoice as overdue', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-OVERDUE-PAID',
      dueDate: '2020-01-01',
      totalCents: 10_000,
    });
    await sendInvoice(invoice.id);

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
