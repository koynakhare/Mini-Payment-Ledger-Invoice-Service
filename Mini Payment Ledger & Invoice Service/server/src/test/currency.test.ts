import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { CURRENCY_CONFIG } from '../config/currencyConfig.js';
import { convertCurrency } from '../utils/convertCurrency.js';
import {
  createVendorWithInvoice,
  gqlExpectError,
  mutateApplyPayment,
  queryInvoice,
  queryLedgerIntegrity,
  resetDatabase,
  sendInvoice,
  teardownTestServer,
} from './helpers.js';

describe('currency', () => {
  beforeEach(() => {
    resetDatabase();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('converts a USD payment to INR invoice currency at the fixed rate', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-INR-01',
      totalCents: 830_000,
      currency: 'INR',
    });
    sendInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 10_000,
      currency: 'USD',
      idempotencyKey: 'fx-pay-01',
    });

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, 830_000);
    assert.equal(updated.remainingCents, 0);
  });

  it('returns integer cent values from currency conversion', () => {
    const converted = convertCurrency(12_345, 'USD', 'INR');
    assert.equal(Number.isInteger(converted), true);
    assert.equal(converted, Math.round(12_345 * CURRENCY_CONFIG.USD_TO_INR));
  });

  it('compares remaining balance in invoice currency after a cross-currency payment', async () => {
    const totalInr = 415_000;
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-INR-REMAIN',
      totalCents: totalInr,
      currency: 'INR',
    });
    sendInvoice(invoice.id);

    const usdPayment = 2_500;
    const appliedInr = convertCurrency(usdPayment, 'USD', 'INR');

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: usdPayment,
      currency: 'USD',
      idempotencyKey: 'fx-remain',
    });

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, appliedInr);
    assert.equal(updated.remainingCents, totalInr - appliedInr);
    assert.equal(Number.isInteger(updated.paidCents), true);
    assert.equal(Number.isInteger(updated.remainingCents), true);
  });

  it('keeps per-currency ledger integrity after cross-currency payment', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-INR-BAL',
      totalCents: 415_000,
      currency: 'INR',
    });
    sendInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 5_000,
      currency: 'USD',
      idempotencyKey: 'fx-bal-01',
    });

    const integrity = await queryLedgerIntegrity();
    assert.equal(integrity.ledgerIntegrity.isBalanced, true);
    assert.ok(integrity.ledgerIntegrity.currencyBalances.every((b) => b.isBalanced));
  });

  it('applies rounded conversion without invoice cent drift', async () => {
    const usdCents = 12_345;
    const expectedInr = Math.round(usdCents * CURRENCY_CONFIG.USD_TO_INR);

    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-ROUND',
      totalCents: expectedInr,
      currency: 'INR',
    });
    sendInvoice(invoice.id);

    await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: usdCents,
      currency: 'USD',
      idempotencyKey: 'fx-round',
    });

    const updated = await queryInvoice(invoice.id);
    assert.equal(updated.paidCents, expectedInr);
    assert.equal(updated.remainingCents, 0);
  });

  it('rejects unsupported payment currencies', async () => {
    const { invoice } = createVendorWithInvoice({
      invoiceNumber: 'INV-BAD-FX',
      totalCents: 50_000,
    });
    sendInvoice(invoice.id);

    const message = await gqlExpectError(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 1000,
          currency: 'EUR',
          idempotencyKey: 'bad-currency',
        },
      }
    );

    assert.match(message, /unsupported currency|does not exist in "Currency" enum/i);
  });
});
