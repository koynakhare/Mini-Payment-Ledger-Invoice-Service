import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { setLlmClient, resetLlmClient, type LlmClient } from '../llm/index.js';
import {
  buildCompliancePrompt,
  parseComplianceResponse,
} from '../services/ComplianceReviewService.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import {
  complianceReviewService,
  createVendorWithInvoice,
  ensureApproverAuth,
  gqlData,
  resetDatabase,
  sendInvoice,
  teardownTestServer,
} from './helpers.js';

describe('compliance review', () => {
  beforeEach(async () => {
    await resetDatabase();
    await ensureApproverAuth();
    resetLlmClient();
  });

  after(async () => {
    resetLlmClient();
    await teardownTestServer();
  });

  it('builds a prompt that includes invoice, vendor, and payment context', () => {
    const prompt = buildCompliancePrompt({
      invoice: {
        id: 'inv-1',
        invoiceNumber: 'INV-100',
        status: 'sent',
        currency: 'USD',
        dueDate: '2026-01-01',
        totalCents: 10_000,
        remainingCents: 10_000,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      vendor: { id: 'v-1', name: 'Metro Logistics' },
      lineItems: [
        { description: 'Freight', quantity: 1, unitPriceCents: 10_000, amountCents: 10_000 },
      ],
      payments: [],
      pendingPaymentAmountCents: 10_000,
      vendorInvoiceHistory: [],
    });

    assert.match(prompt, /INV-100/);
    assert.match(prompt, /Metro Logistics/);
    assert.match(prompt, /Proposed payment amount/i);
    assert.match(prompt, /USD 100\.00/);
    assert.match(prompt, /Never mention cents/i);
    assert.match(prompt, /Do not approve/);
  });

  it('parses a valid structured LLM response into flags', () => {
    const result = parseComplianceResponse({
      summary: 'One amount concern.',
      flags: [
        {
          type: 'AMOUNT_ANOMALY',
          severity: 'medium',
          rationale: 'Payment is unusually large versus vendor history.',
        },
      ],
    });

    assert.equal(result.available, true);
    assert.equal(result.flags.length, 1);
    assert.equal(result.flags[0].type, 'AMOUNT_ANOMALY');
    assert.equal(result.summary, 'One amount concern.');
  });

  it('handles malformed LLM responses without throwing', () => {
    const result = parseComplianceResponse('not-json-object');
    assert.equal(result.available, false);
    assert.match(result.summary, /unavailable/i);
    assert.equal(result.flags.length, 0);
  });

  it('drops invalid flag entries and still returns available=true when summary present', () => {
    const result = parseComplianceResponse({
      summary: 'Mixed quality flags.',
      flags: [
        { type: 'BAD_TYPE', severity: 'high', rationale: 'ignored' },
        {
          type: 'DUPLICATE_INVOICE',
          severity: 'high',
          rationale: 'Same invoice number pattern as prior vendor bill.',
        },
        { type: 'AMOUNT_ANOMALY', severity: 'high' },
      ],
    });

    assert.equal(result.available, true);
    assert.equal(result.flags.length, 1);
    assert.equal(result.flags[0].type, 'DUPLICATE_INVOICE');
  });

  it('degrades gracefully when the LLM client fails', async () => {
    const failingClient: LlmClient = {
      async generate() {
        throw new Error('network down');
      },
    };
    setLlmClient(failingClient);

    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-COMP-FAIL',
      totalCents: 5_000,
    });
    await sendInvoice(invoice.id);

    const review = await complianceReviewService.reviewPayment(invoice.id, 5_000);
    assert.equal(review.available, false);
    assert.match(review.summary, /unavailable/i);
    assert.equal(review.flags.length, 0);
  });

  it('paymentComplianceReview query never mutates payment or invoice state', async () => {
    const mockClient: LlmClient = {
      async generate() {
        return {
          summary: 'Looks fine.',
          flags: [],
        };
      },
    };
    setLlmClient(mockClient);

    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-COMP-RO',
      totalCents: 8_000,
    });
    await sendInvoice(invoice.id);

    const paymentsBefore = await new PaymentRepository().findByInvoiceId(invoice.id);
    const invoiceBefore = await gqlData<{
      invoice: { status: string; paidCents: number; remainingCents: number };
    }>(`query ($id: ID!) { invoice(id: $id) { status paidCents remainingCents } }`, {
      id: invoice.id,
    });

    const review = await gqlData<{
      paymentComplianceReview: {
        available: boolean;
        summary: string;
        flags: Array<{ type: string; severity: string; rationale: string }>;
      };
    }>(
      `query ($invoiceId: ID!, $amount: Int) {
        paymentComplianceReview(invoiceId: $invoiceId, pendingPaymentAmountCents: $amount) {
          available
          summary
          flags { type severity rationale }
        }
      }`,
      { invoiceId: invoice.id, amount: 8_000 }
    );

    assert.equal(review.paymentComplianceReview.available, true);

    const paymentsAfter = await new PaymentRepository().findByInvoiceId(invoice.id);
    const invoiceAfter = await gqlData<{
      invoice: { status: string; paidCents: number; remainingCents: number };
    }>(`query ($id: ID!) { invoice(id: $id) { status paidCents remainingCents } }`, {
      id: invoice.id,
    });

    assert.equal(paymentsBefore.length, paymentsAfter.length);
    assert.deepEqual(invoiceBefore.invoice, invoiceAfter.invoice);
  });
});
