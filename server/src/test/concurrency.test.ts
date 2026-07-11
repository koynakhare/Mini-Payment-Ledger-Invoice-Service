import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { paymentService } from '../services/index.js';
import { AppError } from '../errors/AppError.js';
import {
  countPaymentTransactionsForInvoice,
  countPaymentsForInvoice,
  createVendorWithInvoice,
  gql,
  queryInvoice,
  resetDatabase,
  sendInvoice,
  teardownTestServer,
} from './helpers.js';

async function attemptPayment(invoiceId: string, amountCents: number, idempotencyKey: string) {
  try {
    const payment = await paymentService.applyPayment({ invoiceId, amountCents, idempotencyKey });
    return { ok: true as const, payment };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof AppError ? error : new Error(String(error)),
    };
  }
}

describe('concurrency', () => {
  beforeEach(async () => { await resetDatabase(); });

  after(async () => {
    await teardownTestServer();
  });

  it('allows only one of two concurrent full-balance payments to succeed', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-RACE-01',
      totalCents: 50_000,
    });
    await sendInvoice(invoice.id);

    const [first, second] = await Promise.all([
      attemptPayment(invoice.id, 50_000, 'race-a'),
      attemptPayment(invoice.id, 50_000, 'race-b'),
    ]);

    const successes = [first, second].filter((r) => r.ok);
    const failures = [first, second].filter((r) => !r.ok);

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    if (!failures[0].ok) {
      assert.ok(failures[0].error instanceof AppError);
      assert.ok(
        failures[0].error.code === 'OVERPAYMENT' || failures[0].error.code === 'INVALID_STATUS'
      );
    }

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 50_000);
  });

  it('never records paid amount above invoice total after repeated concurrent races', async () => {
    for (let i = 0; i < 8; i += 1) {
      await resetDatabase();
      const { invoice } = await createVendorWithInvoice({
        invoiceNumber: `INV-RACE-LOOP-${i}`,
        totalCents: 50_000,
      });
      await sendInvoice(invoice.id);

      const results = await Promise.all(
        Array.from({ length: 4 }, (_, index) =>
          attemptPayment(invoice.id, 50_000, `race-loop-${i}-${index}`)
        )
      );

      const successCount = results.filter((r) => r.ok).length;
      assert.equal(successCount, 1);

      const updated = await queryInvoice(invoice.id);
      assert.ok(updated.paidCents <= updated.totalCents);
      assert.equal(updated.paidCents, 50_000);
    }
  });

  it('creates only one payment when duplicate idempotency keys arrive concurrently', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-RACE-IDEM',
      totalCents: 25_000,
    });
    await sendInvoice(invoice.id);

    const key = 'webhook-concurrent-dup';
    const [first, second] = await Promise.all([
      attemptPayment(invoice.id, 25_000, key),
      attemptPayment(invoice.id, 25_000, key),
    ]);

    const successes = [first, second].filter((r) => r.ok);
    assert.equal(successes.length, 2);
    if (first.ok && second.ok) {
      assert.equal(first.payment.id, second.payment.id);
    }

    assert.equal(await countPaymentsForInvoice(invoice.id), 1);
    assert.equal(await countPaymentTransactionsForInvoice(invoice.id), 1);

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 25_000);
  });

  it('rejects the second concurrent GraphQL payment when balance is exhausted', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-RACE-GQL',
      totalCents: 75_000,
    });
    await sendInvoice(invoice.id);

    const [first, second] = await Promise.all([
      gql<{ applyPayment: { id: string } }>(
        `mutation ($input: ApplyPaymentInput!) {
          applyPayment(input: $input) { id }
        }`,
        {
          input: {
            invoiceId: invoice.id,
            amountCents: 75_000,
            idempotencyKey: 'gql-race-1',
          },
        }
      ),
      gql<{ applyPayment: { id: string } }>(
        `mutation ($input: ApplyPaymentInput!) {
          applyPayment(input: $input) { id }
        }`,
        {
          input: {
            invoiceId: invoice.id,
            amountCents: 75_000,
            idempotencyKey: 'gql-race-2',
          },
        }
      ),
    ]);

    const successCount = [first, second].filter((r) => !r.errors).length;
    const errorCount = [first, second].filter((r) => r.errors?.length).length;
    assert.equal(successCount, 1);
    assert.equal(errorCount, 1);

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 75_000);
  });
});
