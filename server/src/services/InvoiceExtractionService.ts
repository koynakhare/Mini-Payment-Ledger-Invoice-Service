import { LlmClientError, llmGenerate, type JsonSchema } from '../llm/index.js';
import { VendorService } from './VendorService.js';
import { AppError } from '../errors/AppError.js';
import type { CurrencyCode } from '../types/index.js';

export interface ExtractedLineItemDraft {
  description: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
  confidence: 'high' | 'medium' | 'low' | 'missing';
}

export interface InvoiceExtractionDraft {
  available: boolean;
  message: string;
  vendorName: string | null;
  matchedVendorId: string | null;
  invoiceNumber: string | null;
  dueDate: string | null;
  currency: CurrencyCode | null;
  lineItems: ExtractedLineItemDraft[];
  missingFields: string[];
  aiFilledFields: string[];
}

export const EXTRACTION_RESPONSE_SCHEMA: JsonSchema = {
  type: 'OBJECT',
  properties: {
    vendorName: { type: 'STRING' },
    invoiceNumber: { type: 'STRING' },
    dueDate: { type: 'STRING' },
    currency: { type: 'STRING', enum: ['USD', 'INR', ''] },
    lineItems: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          quantity: { type: 'INTEGER' },
          unitPriceCents: { type: 'INTEGER' },
        },
        required: ['description', 'quantity', 'unitPriceCents'],
      },
    },
    notes: { type: 'STRING' },
  },
  required: ['vendorName', 'invoiceNumber', 'dueDate', 'currency', 'lineItems'],
};

function emptyDraft(message: string): InvoiceExtractionDraft {
  return {
    available: false,
    message,
    vendorName: null,
    matchedVendorId: null,
    invoiceNumber: null,
    dueDate: null,
    currency: null,
    lineItems: [],
    missingFields: ['vendorName', 'invoiceNumber', 'dueDate', 'lineItems'],
    aiFilledFields: [],
  };
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD or common variants convertible via Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeCurrency(value: unknown): CurrencyCode | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'USD' || upper === 'INR') return upper;
  return null;
}

function lineConfidence(item: {
  description: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
}): ExtractedLineItemDraft['confidence'] {
  const present = [item.description, item.quantity, item.unitPriceCents].filter(
    (value) => value !== null && value !== undefined && value !== ''
  ).length;
  if (present === 3) return 'high';
  if (present === 2) return 'medium';
  if (present === 1) return 'low';
  return 'missing';
}

export function buildExtractionPrompt(): string {
  return [
    'Extract invoice fields from the provided document for an accounts-payable system.',
    'Return structured JSON only. Do not create or submit an invoice.',
    'Field expectations:',
    '- vendorName: vendor / supplier name',
    '- invoiceNumber: invoice / bill number',
    '- dueDate: ISO date YYYY-MM-DD when possible',
    '- currency: USD or INR only; empty string if unknown',
    '- lineItems: array of { description, quantity, unitPriceCents }',
    'unitPriceCents must be integer cents (e.g. $12.34 -> 1234).',
    'If a field is unknown, use an empty string / 0 / empty array rather than guessing.',
    'Prefer fewer accurate line items over invented ones.',
  ].join('\n');
}

export function parseExtractionResponse(
  raw: unknown,
  matchedVendorId: string | null = null
): InvoiceExtractionDraft {
  if (!raw || typeof raw !== 'object') {
    return emptyDraft('Could not extract invoice fields from the document.');
  }

  const record = raw as Record<string, unknown>;
  const vendorName =
    typeof record.vendorName === 'string' && record.vendorName.trim()
      ? record.vendorName.trim()
      : null;
  const invoiceNumber =
    typeof record.invoiceNumber === 'string' && record.invoiceNumber.trim()
      ? record.invoiceNumber.trim()
      : null;
  const dueDate = normalizeDate(record.dueDate);
  const currency = normalizeCurrency(record.currency);

  const lineItemsRaw = Array.isArray(record.lineItems) ? record.lineItems : [];
  const lineItems: ExtractedLineItemDraft[] = [];
  for (const entry of lineItemsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const description =
      typeof item.description === 'string' && item.description.trim()
        ? item.description.trim()
        : null;
    const quantity =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0
        ? Math.trunc(item.quantity)
        : null;
    const unitPriceCents =
      typeof item.unitPriceCents === 'number' &&
      Number.isFinite(item.unitPriceCents) &&
      item.unitPriceCents >= 0
        ? Math.trunc(item.unitPriceCents)
        : null;
    lineItems.push({
      description,
      quantity,
      unitPriceCents,
      confidence: lineConfidence({ description, quantity, unitPriceCents }),
    });
  }

  const missingFields: string[] = [];
  const aiFilledFields: string[] = [];

  if (!vendorName) missingFields.push('vendorName');
  else aiFilledFields.push('vendorName');
  if (!invoiceNumber) missingFields.push('invoiceNumber');
  else aiFilledFields.push('invoiceNumber');
  if (!dueDate) missingFields.push('dueDate');
  else aiFilledFields.push('dueDate');
  if (!currency) missingFields.push('currency');
  else aiFilledFields.push('currency');

  const usableLine = lineItems.find(
    (item) => item.description && item.quantity && item.unitPriceCents !== null
  );
  if (!usableLine) missingFields.push('lineItems');
  else aiFilledFields.push('lineItems');

  const available = Boolean(vendorName || invoiceNumber || dueDate || usableLine);
  if (!available) {
    return emptyDraft(
      'Document did not contain enough recognizable invoice fields. Enter details manually.'
    );
  }

  const notes =
    typeof record.notes === 'string' && record.notes.trim() ? ` ${record.notes.trim()}` : '';

  return {
    available: true,
    message: missingFields.length
      ? `Extracted a draft with ${missingFields.length} field(s) needing review.${notes}`
      : `Extracted a complete draft for review before submit.${notes}`,
    vendorName,
    matchedVendorId,
    invoiceNumber,
    dueDate,
    currency,
    lineItems,
    missingFields,
    aiFilledFields,
  };
}

export class InvoiceExtractionService {
  constructor(private readonly vendors = new VendorService()) {}

  async extractFromDocument(input: {
    documentText?: string | null;
    documentBase64?: string | null;
    mimeType?: string | null;
  }): Promise<InvoiceExtractionDraft> {
    const text = input.documentText?.trim() ?? '';
    const base64 = input.documentBase64?.trim() ?? '';
    const mimeType = input.mimeType?.trim() || 'image/png';
    const allowedMime = new Set([
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
    ]);

    if (!text && !base64) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Provide documentText and/or documentBase64 to extract invoice fields.'
      );
    }

    if (base64 && mimeType && !allowedMime.has(mimeType) && !text) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Unsupported document type. Use plain text, PDF, or PNG/JPEG/WebP.'
      );
    }

    if (base64 && base64.length > 6_000_000) {
      throw new AppError('VALIDATION_ERROR', 'Document payload is too large.');
    }

    if (text && text.length > 100_000) {
      throw new AppError('VALIDATION_ERROR', 'Document text is too large.');
    }

    try {
      const raw = await llmGenerate({
        prompt: [
          buildExtractionPrompt(),
          text ? `\nDocument text:\n${text}` : '\nDocument image/file is attached.',
        ].join('\n'),
        responseSchema: EXTRACTION_RESPONSE_SCHEMA,
        inlineData: base64
          ? [{ mimeType, dataBase64: base64.replace(/^data:[^;]+;base64,/, '') }]
          : undefined,
        temperature: 0.1,
        timeoutMs: 30_000,
      });

      const parsed = parseExtractionResponse(raw);
      if (!parsed.available) {
        return parsed;
      }

      let matchedVendorId: string | null = null;
      if (parsed.vendorName) {
        const vendors = await this.vendors.listVendors();
        const needle = parsed.vendorName.toLowerCase();
        const exact = vendors.find((vendor) => vendor.name.toLowerCase() === needle);
        const partial = vendors.find((vendor) => vendor.name.toLowerCase().includes(needle));
        matchedVendorId = exact?.id ?? partial?.id ?? null;
      }

      return {
        ...parsed,
        matchedVendorId,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof LlmClientError) {
        return emptyDraft(`Invoice extraction unavailable: ${error.message}`);
      }
      return emptyDraft('Invoice extraction unavailable due to an unexpected error.');
    }
  }
}
