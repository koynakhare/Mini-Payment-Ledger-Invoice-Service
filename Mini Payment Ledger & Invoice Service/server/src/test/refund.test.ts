import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { LedgerRepository } from '../repositories/LedgerRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import {
  createVendorWithInvoice,
  gql,
  gqlExpectError,
  mutateApplyPayment,
  mutateReversePayment,
  queryInvoice,
  queryLedgerIntegrity,
  resetDatabase,
  sendInvoice,
  teardownTestServer,
} from './helpers.js';

describe('refund', () => {
  beforeEach(() => {
    resetDatabase();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('creates a reversing transaction without deleting the original payment transaction', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-REFUND-01',
      totalCents: 125_000,
    });
    sendInvoice(invoice.id);

    const pay = await gql<{ applyPayment: { id: string; transactionId: string } }>(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id transactionId }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 125_000,
          idempotencyKey: 'refund-pay-01',
        },
      }
    );

    const paymentId = pay.data!.applyPayment.id;
    const paymentTxId = pay.data!.applyPayment.transactionId;
    const ledger = new LedgerRepository();

    await mutateReversePayment({
      paymentId,
      reversalType: 'refund',
      idempotencyKey: 'refund-rev-01',
    });

    assert.ok(ledger.findTransactionById(paymentTxId));
    assert.equal(new PaymentRepository().findByInvoiceId(invoice.id).length, 1);
  });

  it('keeps ledger integrity balanced after a full refund', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-REFUND-BAL',
      totalCents: 64_800,
    });
    sendInvoice(invoice.id);

    const pay = await gql<{ applyPayment: { id: string } }>(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 64_800,
          idempotencyKey: 'refund-bal-pay',
        },
      }
    );

    await mutateReversePayment({
      paymentId: pay.data!.applyPayment.id,
      reversalType: 'refund',
      idempotencyKey: 'refund-bal-rev',
    });

    const integrity = await queryLedgerIntegrity();
    assert.equal(integrity.ledgerIntegrity.isBalanced, true);
  });

  it('reverts a fully paid invoice to sent after a full refund', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-REFUND-STATUS',
      totalCents: 80_000,
    });
    sendInvoice(invoice.id);

    const pay = await gql<{ applyPayment: { id: string } }>(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 80_000,
          idempotencyKey: 'refund-status-pay',
        },
      }
    );

    await mutateReversePayment({
      paymentId: pay.data!.applyPayment.id,
      reversalType: 'refund',
      idempotencyKey: 'refund-status-rev',
    });

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.status, 'sent');
    assert.equal(updated.paidCents, 0);
    assert.equal(updated.remainingCents, 80_000);
  });

  it('reverts a fully paid invoice to partially_paid after refunding one of two payments', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-REFUND-PARTIAL-STATE',
      totalCents: 100_000,
    });
    sendInvoice(invoice.id);

    const payA = await gql<{ applyPayment: { id: string } }>(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 60_000,
          idempotencyKey: 'refund-partial-a',
        },
      }
    );
    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 40_000,
      idempotencyKey: 'refund-partial-b',
    });

    await mutateReversePayment({
      paymentId: payA.data!.applyPayment.id,
      reversalType: 'refund',
      idempotencyKey: 'refund-partial-rev',
    });

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 40_000);
    assert.equal(updated.remainingCents, 60_000);
    assert.equal(updated.status, 'partially_paid');
  });

  it('rejects a second full refund on an already-refunded payment', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-REFUND-EXCESS',
      totalCents: 50_000,
    });
    sendInvoice(invoice.id);

    const pay = await gql<{ applyPayment: { id: string } }>(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 50_000,
          idempotencyKey: 'refund-excess-pay',
        },
      }
    );

    await mutateReversePayment({
      paymentId: pay.data!.applyPayment.id,
      reversalType: 'refund',
      idempotencyKey: 'refund-excess-rev-1',
    });

    const message = await gqlExpectError(
      `mutation ($input: ReversePaymentInput!) {
        reversePayment(input: $input) { id }
      }`,
      {
        input: {
          paymentId: pay.data!.applyPayment.id,
          reversalType: 'refund',
          idempotencyKey: 'refund-excess-rev-2',
        },
      }
    );

    assert.match(message, /fully reversed|already been/i);
  });

  it('returns the same reversal for duplicate refund idempotency keys', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-REFUND-IDEM',
      totalCents: 33_300,
    });
    sendInvoice(invoice.id);

    const pay = await gql<{ applyPayment: { id: string } }>(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 33_300,
          idempotencyKey: 'refund-idem-pay',
        },
      }
    );

    const key = 'refund-webhook-retry';
    const first = await gql<{ reversePayment: { id: string } }>(
      `mutation ($input: ReversePaymentInput!) {
        reversePayment(input: $input) { id }
      }`,
      {
        input: {
          paymentId: pay.data!.applyPayment.id,
          reversalType: 'refund',
          idempotencyKey: key,
        },
      }
    );
    const second = await gql<{ reversePayment: { id: string } }>(
      `mutation ($input: ReversePaymentInput!) {
        reversePayment(input: $input) { id }
      }`,
      {
        input: {
          paymentId: pay.data!.applyPayment.id,
          reversalType: 'refund',
          idempotencyKey: key,
        },
      }
    );

    assert.equal(first.data!.reversePayment.id, second.data!.reversePayment.id);
  });
});
