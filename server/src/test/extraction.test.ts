import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { resetLlmClient, setLlmClient, type LlmClient } from '../llm/index.js';
import {
  buildExtractionPrompt,
  parseExtractionResponse,
} from '../services/InvoiceExtractionService.js';
import {
  ensureApproverAuth,
  gqlData,
  gqlExpectErrorDetails,
  invoiceExtractionService,
  resetDatabase,
  teardownTestServer,
  vendorService,
} from './helpers.js';

describe('invoice extraction', () => {
  beforeEach(async () => {
    await resetDatabase();
    await ensureApproverAuth();
    resetLlmClient();
  });

  after(async () => {
    resetLlmClient();
    await teardownTestServer();
  });

  it('builds an extraction prompt that forbids creating invoices', () => {
    const prompt = buildExtractionPrompt();
    assert.match(prompt, /Do not create or submit an invoice/i);
    assert.match(prompt, /unitPriceCents/);
  });

  it('parses a valid extraction payload into a draft', () => {
    const draft = parseExtractionResponse({
      vendorName: 'Metro Logistics LLC',
      invoiceNumber: 'INV-9001',
      dueDate: '2026-08-01',
      currency: 'USD',
      lineItems: [
        { description: 'Linehaul', quantity: 2, unitPriceCents: 15000 },
      ],
    });

    assert.equal(draft.available, true);
    assert.equal(draft.invoiceNumber, 'INV-9001');
    assert.equal(draft.lineItems[0].unitPriceCents, 15000);
    assert.ok(draft.aiFilledFields.includes('invoiceNumber'));
    assert.equal(draft.missingFields.length, 0);
  });

  it('reports missing fields for incomplete or garbled extraction', () => {
    const draft = parseExtractionResponse({
      vendorName: '',
      invoiceNumber: '',
      dueDate: 'not-a-date',
      currency: 'EUR',
      lineItems: [{ description: '', quantity: 0, unitPriceCents: -1 }],
    });
    assert.equal(draft.available, false);
    assert.match(draft.message, /enough recognizable/i);
  });

  it('extractInvoiceFromDocument never creates vendor or invoice records', async () => {
    await vendorService.createVendor({ name: 'Metro Logistics LLC' });

    const mock: LlmClient = {
      async generate() {
        return {
          vendorName: 'Metro Logistics LLC',
          invoiceNumber: 'INV-EXTRACT-1',
          dueDate: '2026-09-15',
          currency: 'USD',
          lineItems: [
            { description: 'Fuel surcharge', quantity: 1, unitPriceCents: 4200 },
          ],
        };
      },
    };
    setLlmClient(mock);

    const before = await gqlData<{
      vendors: Array<{ id: string }>;
      invoices: Array<{ id: string }>;
    }>(`query { vendors { id } invoices { id } }`);

    const result = await gqlData<{
      extractInvoiceFromDocument: {
        available: boolean;
        invoiceNumber: string | null;
        matchedVendorId: string | null;
        missingFields: string[];
      };
    }>(
      `query ($text: String) {
        extractInvoiceFromDocument(documentText: $text) {
          available
          invoiceNumber
          matchedVendorId
          missingFields
          aiFilledFields
          lineItems { description quantity unitPriceCents confidence }
        }
      }`,
      {
        text: 'Invoice INV-EXTRACT-1 from Metro Logistics LLC due 2026-09-15 for Fuel surcharge $42.00',
      }
    );

    assert.equal(result.extractInvoiceFromDocument.available, true);
    assert.equal(result.extractInvoiceFromDocument.invoiceNumber, 'INV-EXTRACT-1');
    assert.ok(result.extractInvoiceFromDocument.matchedVendorId);

    const after = await gqlData<{
      vendors: Array<{ id: string }>;
      invoices: Array<{ id: string }>;
    }>(`query { vendors { id } invoices { id } }`);

    assert.equal(before.vendors.length, after.vendors.length);
    assert.equal(before.invoices.length, after.invoices.length);
    assert.equal(after.invoices.length, 0);
  });

  it('degrades gracefully when the LLM fails', async () => {
    setLlmClient({
      async generate() {
        throw new Error('boom');
      },
    });

    const draft = await invoiceExtractionService.extractFromDocument({
      documentText: 'totally garbled $$$',
    });
    assert.equal(draft.available, false);
    assert.match(draft.message, /unavailable/i);
  });

  it('rejects empty extraction requests with validation error', async () => {
    const error = await gqlExpectErrorDetails(
      `query {
        extractInvoiceFromDocument {
          available
          message
        }
      }`
    );
    assert.equal(error.code, 'VALIDATION_ERROR');
  });

  it('leaves createInvoice authorization unchanged for unauthenticated callers', async () => {
    const error = await gqlExpectErrorDetails(
      `mutation ($input: CreateInvoiceInput!) {
        createInvoice(input: $input) { id }
      }`,
      {
        input: {
          vendorId: 'x',
          invoiceNumber: 'INV-NOAUTH-T3',
          dueDate: '2026-12-31',
          lineItems: [{ description: 'x', quantity: 1, unitPriceCents: 100 }],
        },
      },
      { user: null }
    );
    assert.equal(error.code, 'UNAUTHENTICATED');
  });
});
