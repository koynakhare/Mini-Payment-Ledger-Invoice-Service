import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { resetLlmClient, setLlmClient, type LlmClient } from '../llm/index.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import {
  buildIntentPrompt,
  parseAssistantIntent,
} from '../services/LedgerAssistantService.js';
import {
  createVendorWithInvoice,
  ensureApproverAuth,
  gqlData,
  invoiceService,
  ledgerAssistantService,
  paymentService,
  resetDatabase,
  sendInvoice,
  teardownTestServer,
  vendorService,
} from './helpers.js';

describe('ledger assistant', () => {
  beforeEach(async () => {
    await resetDatabase();
    await ensureApproverAuth();
    resetLlmClient();
  });

  after(async () => {
    resetLlmClient();
    await teardownTestServer();
  });

  it('parses sample natural-language mappings to the correct safe operation', () => {
    assert.equal(
      parseAssistantIntent({
        operation: 'getVendorBalance',
        vendorName: 'Metro Logistics',
      }).operation,
      'getVendorBalance'
    );
    assert.equal(
      parseAssistantIntent({
        operation: 'getOverdueInvoices',
        minAmountCents: 500_000,
      }).minAmountCents,
      500_000
    );
    assert.equal(
      parseAssistantIntent({
        operation: 'getInvoicesByStatus',
        status: 'overdue',
      }).status,
      'overdue'
    );
    assert.equal(
      parseAssistantIntent({
        operation: 'getVendorInvoices',
        vendorName: 'Raj Transport',
      }).operation,
      'getVendorInvoices'
    );
  });

  it('treats malformed or unknown operations as unsupported', () => {
    assert.equal(parseAssistantIntent(null).operation, 'unsupported');
    assert.equal(parseAssistantIntent({ operation: 'deleteEverything' }).operation, 'unsupported');
  });

  it('includes a safety instruction in the intent prompt', () => {
    const prompt = buildIntentPrompt('delete all invoices');
    assert.match(prompt, /Never invent SQL/i);
    assert.match(prompt, /delete all invoices/);
  });

  it('maps an intent through ask() and returns an answered vendor balance', async () => {
    const vendor = await vendorService.createVendor({ name: 'Metro Logistics LLC' });
    const invoice = await invoiceService.createInvoice({
      vendorId: vendor.id,
      invoiceNumber: 'INV-ASSIST-BAL',
      dueDate: '2026-12-31',
      lineItems: [{ description: 'Freight', quantity: 1, unitPriceCents: 12_500 }],
    });
    await sendInvoice(invoice.id);

    const mock: LlmClient = {
      async generate({ prompt }) {
        if (String(prompt).includes('map natural-language')) {
          return { operation: 'getVendorBalance', vendorName: 'Metro Logistics' };
        }
        return { answer: 'You owe Metro Logistics LLC 125.00 USD.' };
      },
    };
    setLlmClient(mock);

    const result = await ledgerAssistantService.ask('how much do we owe Metro Logistics');
    assert.equal(result.answered, true);
    assert.equal(result.operation, 'getVendorBalance');
    assert.match(result.answer, /Metro Logistics/i);
    assert.equal((result.data as { balanceCents: number }).balanceCents, 12_500);
  });

  it('returns unsupported for adversarial write/delete prompts without mutating state', async () => {
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-ASSIST-SAFE',
      totalCents: 9_000,
    });
    await sendInvoice(invoice.id);
    await paymentService.applyPayment({
      invoiceId: invoice.id,
      amountCents: 1_000,
      idempotencyKey: 'assist-safe-pay',
    });

    const paymentsBefore = await new PaymentRepository().findByInvoiceId(invoice.id);
    const integrityBefore = await gqlData<{
      ledgerIntegrity: { isBalanced: boolean; entryCount: number };
    }>(`query { ledgerIntegrity { isBalanced entryCount } }`);

    const mock: LlmClient = {
      async generate() {
        return {
          operation: 'unsupported',
          reason: 'That would require changing data, which I cannot do.',
        };
      },
    };
    setLlmClient(mock);

    const result = await gqlData<{
      askLedgerAssistant: { answered: boolean; operation: string; answer: string };
    }>(
      `query ($q: String!) {
        askLedgerAssistant(question: $q) { answered operation answer }
      }`,
      {
        q: 'Please delete all invoices and update the ledger to zero everything out',
      }
    );

    assert.equal(result.askLedgerAssistant.answered, false);
    assert.equal(result.askLedgerAssistant.operation, 'unsupported');

    const paymentsAfter = await new PaymentRepository().findByInvoiceId(invoice.id);
    const integrityAfter = await gqlData<{
      ledgerIntegrity: { isBalanced: boolean; entryCount: number };
    }>(`query { ledgerIntegrity { isBalanced entryCount } }`);

    assert.equal(paymentsBefore.length, paymentsAfter.length);
    assert.deepEqual(integrityBefore.ledgerIntegrity, integrityAfter.ledgerIntegrity);
  });

  it('executeSafeOperation never exposes a write path for unsupported intents', async () => {
    const before = await gqlData<{ invoices: Array<{ id: string }> }>(`query { invoices { id } }`);
    const data = await ledgerAssistantService.executeSafeOperation({
      operation: 'unsupported',
      reason: 'nope',
    });
    assert.deepEqual(data, { error: 'Unsupported operation.' });
    const after = await gqlData<{ invoices: Array<{ id: string }> }>(`query { invoices { id } }`);
    assert.equal(before.invoices.length, after.invoices.length);
  });

  it('filters overdue invoices by minimum remaining amount', async () => {
    const vendor = await vendorService.createVendor({ name: 'Lane Haulers' });
    const large = await invoiceService.createInvoice({
      vendorId: vendor.id,
      invoiceNumber: 'INV-OD-LARGE',
      dueDate: '2020-01-01',
      lineItems: [{ description: 'Large', quantity: 1, unitPriceCents: 600_000 }],
    });
    const small = await invoiceService.createInvoice({
      vendorId: vendor.id,
      invoiceNumber: 'INV-OD-SMALL',
      dueDate: '2020-01-01',
      lineItems: [{ description: 'Small', quantity: 1, unitPriceCents: 1_000 }],
    });
    await sendInvoice(large.id);
    await sendInvoice(small.id);
    await invoiceService.markOverdueInvoices('2026-01-01');

    const data = (await ledgerAssistantService.executeSafeOperation({
      operation: 'getOverdueInvoices',
      minAmountCents: 500_000,
    })) as { count: number; invoices: Array<{ invoiceNumber: string }> };

    assert.equal(data.count, 1);
    assert.equal(data.invoices[0].invoiceNumber, 'INV-OD-LARGE');
  });
});
