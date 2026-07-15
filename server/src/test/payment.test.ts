import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import {
  countPaymentTransactionsForInvoice,
  countPaymentsForInvoice,
  createVendorWithInvoice,
  gql,
  gqlExpectError,
  mutateApplyPayment,
  queryInvoice,
  ensureApproverAuth,
  resetDatabase,
  sendInvoice,
  teardownTestServer,
} from './helpers.js';

describe('payment', () => {
  beforeEach(async () => {
    await resetDatabase();
    await ensureApproverAuth();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('marks invoice paid after a full payment', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-PAY-FULL',
      totalCents: 156_780,
    });
    await sendInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 156_780,
      idempotencyKey: 'pay-full-01',
    });

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.status, 'paid');
    assert.equal(updated.paidCents, 156_780);
    assert.equal(updated.remainingCents, 0);
  });

  it('marks invoice partially_paid after a partial payment', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-PARTIAL-01',
      totalCents: 427_583,
    });
    await sendInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 150_000,
      idempotencyKey: 'partial-01',
    });

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.status, 'partially_paid');
    assert.equal(updated.paidCents, 150_000);
    assert.equal(updated.remainingCents, 277_583);
  });

  it('marks invoice paid after multiple partial payments sum to total', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-PARTIAL-MULTI',
      totalCents: 300_000,
    });
    await sendInvoice(invoice.id);

    const parts = [95_000, 82_500, 72_500, 50_000];
    for (let i = 0; i < parts.length; i += 1) {
      await mutateApplyPayment({
        invoiceId: invoice.id,
        amountCents: parts[i],
        idempotencyKey: `partial-multi-${i}`,
      });
    }

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.status, 'paid');
    assert.equal(updated.paidCents, 300_000);
  });

  it('reduces remaining balance by exactly each partial payment amount', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-DRIFT',
      totalCents: 999_999,
    });
    await sendInvoice(invoice.id);

    const payments = [33_333, 44_444, 55_555];
    let expectedRemaining = 999_999;
    for (let i = 0; i < payments.length; i += 1) {
      await mutateApplyPayment({
        invoiceId: invoice.id,
        amountCents: payments[i],
        idempotencyKey: `drift-${i}`,
      });
      expectedRemaining -= payments[i];
      const updated = await queryInvoice(invoice.id);
      assert.equal(updated.remainingCents, expectedRemaining);
    }
  });

  it('rejects a payment greater than remaining balance', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-OVER-01',
      totalCents: 50_000,
    });
    await sendInvoice(invoice.id);

    const message = await gqlExpectError(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 50_001,
          idempotencyKey: 'over-single',
        },
      }
    );

    assert.match(message, /exceeds remaining balance/i);
    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 0);
  });

  it('does not create a payment row when overpayment is rejected', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-OVER-NO-TX',
      totalCents: 50_000,
    });
    await sendInvoice(invoice.id);

    await gqlExpectError(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 75_000,
          idempotencyKey: 'over-no-tx',
        },
      }
    );

    assert.equal(await countPaymentsForInvoice(invoice.id), 0);
    assert.equal(await countPaymentTransactionsForInvoice(invoice.id), 0);
  });

  it('rejects cumulative overpayment across prior payments', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-OVER-CUMUL',
      totalCents: 100_000,
    });
    await sendInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 60_000,
      idempotencyKey: 'cumul-01',
    });

    const message = await gqlExpectError(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 50_000,
          idempotencyKey: 'cumul-02',
        },
      }
    );

    assert.match(message, /exceeds remaining balance/i);
    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 60_000);
  });

  it('creates exactly one payment transaction for a new idempotency key', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-IDEM-NEW',
      totalCents: 40_000,
    });
    await sendInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 40_000,
      idempotencyKey: 'webhook-ch-new',
    });

    assert.equal(await countPaymentsForInvoice(invoice.id), 1);
    assert.equal(await countPaymentTransactionsForInvoice(invoice.id), 1);
    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 40_000);
  });

  it('does not double-count when the same idempotency key is submitted twice', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-IDEM-DUP',
      totalCents: 62_500,
    });
    await sendInvoice(invoice.id);

    const key = 'webhook-retry-001';
    const first = await gql<{ applyPayment: { id: string } }>(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      { input: { invoiceId: invoice.id, amountCents: 30_000, idempotencyKey: key } }
    );
    const second = await gql<{ applyPayment: { id: string } }>(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      { input: { invoiceId: invoice.id, amountCents: 30_000, idempotencyKey: key } }
    );

    assert.equal(first.errors, undefined);
    assert.equal(second.errors, undefined);
    assert.equal(first.data!.applyPayment.id, second.data!.applyPayment.id);
    assert.equal(await countPaymentsForInvoice(invoice.id), 1);

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 30_000);
  });

  it('leaves paid total unchanged after a duplicate idempotency key retry', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-IDEM-STABLE',
      totalCents: 20_000,
    });
    await sendInvoice(invoice.id);

    const key = 'webhook-stable';
    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 20_000,
      idempotencyKey: key,
    });
    const before = await queryInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 20_000,
      idempotencyKey: key,
    });
    const after = await queryInvoice(invoice.id);

    assert.deepEqual(after, before);
    assert.equal(await countPaymentTransactionsForInvoice(invoice.id), 1);
  });

  it('allows separate payments with different idempotency keys', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-IDEM-SEPARATE',
      totalCents: 90_000,
    });
    await sendInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 35_000,
      idempotencyKey: 'pay-a',
    });
    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 25_000,
      idempotencyKey: 'pay-b',
    });

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 60_000);
    assert.equal(await countPaymentsForInvoice(invoice.id), 2);
    assert.equal(await countPaymentTransactionsForInvoice(invoice.id), 2);
  });
});
