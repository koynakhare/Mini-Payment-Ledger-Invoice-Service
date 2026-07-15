import { LlmClientError, llmGenerate, type JsonSchema } from '../llm/index.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { InvoiceRepository } from '../repositories/InvoiceRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import { VendorService } from './VendorService.js';
import type { InvoiceStatus } from '../types/index.js';

export type SafeAssistantOperation =
  | 'getVendorBalance'
  | 'getOverdueInvoices'
  | 'getInvoicesByStatus'
  | 'getVendorInvoices'
  | 'unsupported';

export interface AssistantIntent {
  operation: SafeAssistantOperation;
  vendorName?: string | null;
  minAmountCents?: number | null;
  status?: InvoiceStatus | null;
  reason?: string | null;
}

export interface LedgerAssistantAnswer {
  answered: boolean;
  operation: SafeAssistantOperation;
  answer: string;
  data: unknown;
}

const INVOICE_STATUSES = new Set<InvoiceStatus>([
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
]);

const OPERATIONS = new Set<SafeAssistantOperation>([
  'getVendorBalance',
  'getOverdueInvoices',
  'getInvoicesByStatus',
  'getVendorInvoices',
  'unsupported',
]);

export const ASSISTANT_INTENT_SCHEMA: JsonSchema = {
  type: 'OBJECT',
  properties: {
    operation: {
      type: 'STRING',
      enum: [
        'getVendorBalance',
        'getOverdueInvoices',
        'getInvoicesByStatus',
        'getVendorInvoices',
        'unsupported',
      ],
    },
    vendorName: { type: 'STRING' },
    minAmountCents: { type: 'INTEGER' },
    status: {
      type: 'STRING',
      enum: ['draft', 'sent', 'partially_paid', 'paid', 'overdue'],
    },
    reason: { type: 'STRING' },
  },
  required: ['operation'],
};

export const ASSISTANT_ANSWER_SCHEMA: JsonSchema = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
  },
  required: ['answer'],
};

export function parseAssistantIntent(raw: unknown): AssistantIntent {
  if (!raw || typeof raw !== 'object') {
    return {
      operation: 'unsupported',
      reason: 'Could not interpret the question.',
    };
  }

  const record = raw as Record<string, unknown>;
  const operation = String(record.operation ?? '') as SafeAssistantOperation;
  if (!OPERATIONS.has(operation)) {
    return {
      operation: 'unsupported',
      reason: 'Unrecognized operation.',
    };
  }

  const statusRaw = record.status;
  const status =
    typeof statusRaw === 'string' && INVOICE_STATUSES.has(statusRaw as InvoiceStatus)
      ? (statusRaw as InvoiceStatus)
      : null;

  const minAmount =
    typeof record.minAmountCents === 'number' && Number.isFinite(record.minAmountCents)
      ? Math.max(0, Math.trunc(record.minAmountCents))
      : null;

  return {
    operation,
    vendorName: typeof record.vendorName === 'string' ? record.vendorName.trim() : null,
    minAmountCents: minAmount,
    status,
    reason: typeof record.reason === 'string' ? record.reason.trim() : null,
  };
}

export function buildIntentPrompt(question: string): string {
  return [
    'You map natural-language questions about an accounts-payable ledger to ONE safe operation.',
    'Never invent SQL. Never choose writes, deletes, updates, payments, or refunds.',
    'If the user asks to change data, delete anything, pay invoices, or run arbitrary queries, return operation unsupported.',
    '',
    'Supported operations:',
    '- getVendorBalance: how much is owed to a vendor (needs vendorName)',
    '- getOverdueInvoices: overdue invoices, optional minAmountCents filter',
    '- getInvoicesByStatus: list invoices by status (needs status: draft|sent|partially_paid|paid|overdue)',
    '- getVendorInvoices: list invoices for a vendor (needs vendorName)',
    '- unsupported: anything else',
    '',
    `User question: ${question}`,
  ].join('\n');
}

export function buildAnswerPrompt(question: string, data: unknown): string {
  return [
    'Turn the following structured ledger query result into a concise plain-English answer.',
    'Only use the provided data. Do not invent numbers or invoices.',
    'If the data shows no matches, say so clearly.',
    '',
    `Original question: ${question}`,
    '',
    'Data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function formatCents(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function fallbackAnswer(question: string, data: unknown): string {
  if (!data || typeof data !== 'object') {
    return 'I looked that up, but could not format a clear answer from the data.';
  }
  return `Based on the ledger data for "${question}", here is what I found: ${JSON.stringify(data)}.`;
}

export class LedgerAssistantService {
  constructor(
    private readonly vendors = new VendorService(),
    private readonly invoices = new InvoiceRepository(),
    private readonly payments = new PaymentRepository(),
    private readonly accounts = new AccountRepository()
  ) {}

  async ask(question: string): Promise<LedgerAssistantAnswer> {
    const trimmed = question.trim();
    if (!trimmed) {
      return {
        answered: false,
        operation: 'unsupported',
        answer: "I can't answer that yet. Please ask a question about vendors, invoice status, or overdue amounts.",
        data: null,
      };
    }

    let intent: AssistantIntent;
    try {
      const rawIntent = await llmGenerate({
        prompt: buildIntentPrompt(trimmed),
        responseSchema: ASSISTANT_INTENT_SCHEMA,
        temperature: 0,
      });
      intent = parseAssistantIntent(rawIntent);
    } catch (error) {
      const message =
        error instanceof LlmClientError
          ? `Assistant unavailable: ${error.message}`
          : 'Assistant unavailable due to an unexpected error.';
      return {
        answered: false,
        operation: 'unsupported',
        answer: message,
        data: null,
      };
    }

    if (intent.operation === 'unsupported') {
      return {
        answered: false,
        operation: 'unsupported',
        answer:
          intent.reason?.trim() ||
          "I can't answer that yet. Try asking about a vendor balance, overdue invoices, invoices by status, or invoices for a vendor.",
        data: null,
      };
    }

    const data = await this.executeSafeOperation(intent);
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return {
        answered: false,
        operation: intent.operation,
        answer: String((data as { error: string }).error),
        data,
      };
    }

    let answer: string;
    try {
      const rawAnswer = await llmGenerate({
        prompt: buildAnswerPrompt(trimmed, data),
        responseSchema: ASSISTANT_ANSWER_SCHEMA,
        temperature: 0.2,
      });
      if (
        rawAnswer &&
        typeof rawAnswer === 'object' &&
        typeof (rawAnswer as { answer?: unknown }).answer === 'string'
      ) {
        answer = ((rawAnswer as { answer: string }).answer).trim();
      } else if (typeof rawAnswer === 'string' && rawAnswer.trim()) {
        answer = rawAnswer.trim();
      } else {
        answer = fallbackAnswer(trimmed, data);
      }
    } catch {
      answer = fallbackAnswer(trimmed, data);
    }

    return {
      answered: true,
      operation: intent.operation,
      answer,
      data,
    };
  }

  /** Exposed for tests — only executes the fixed safe operation set. */
  async executeSafeOperation(intent: AssistantIntent): Promise<unknown> {
    switch (intent.operation) {
      case 'getVendorBalance':
        return this.getVendorBalance(intent.vendorName ?? '');
      case 'getOverdueInvoices':
        return this.getOverdueInvoices(intent.minAmountCents ?? 0);
      case 'getInvoicesByStatus':
        return this.getInvoicesByStatus(intent.status ?? null);
      case 'getVendorInvoices':
        return this.getVendorInvoices(intent.vendorName ?? '');
      case 'unsupported':
      default:
        return { error: 'Unsupported operation.' };
    }
  }

  private async findVendorByName(vendorName: string) {
    const needle = vendorName.trim().toLowerCase();
    if (!needle) return null;
    const vendors = await this.vendors.listVendors();
    const exact = vendors.find((vendor) => vendor.name.toLowerCase() === needle);
    if (exact) return exact;
    return vendors.find((vendor) => vendor.name.toLowerCase().includes(needle)) ?? null;
  }

  private async getVendorBalance(vendorName: string) {
    const vendor = await this.findVendorByName(vendorName);
    if (!vendor) {
      return { error: `I couldn't find a vendor matching "${vendorName}".` };
    }
    const account = await this.accounts.findByVendorId(vendor.id);
    if (!account) {
      return { error: `No payable account found for ${vendor.name}.` };
    }
    const balanceCents = await this.accounts.getBalanceCents(account.id);
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      payableAccountId: account.id,
      balanceCents,
      balanceDisplay: formatCents(balanceCents, 'USD'),
      note: 'Positive balance means amount still owed to the vendor (payable).',
    };
  }

  private async getOverdueInvoices(minAmountCents: number) {
    const invoices = await this.invoices.findAll('overdue');
    const rows = [];
    for (const invoice of invoices) {
      const totalCents = await this.invoices.getTotalCents(invoice.id);
      const paidCents = await this.payments.getNetPaidCents(invoice.id);
      const remainingCents = totalCents - paidCents;
      if (remainingCents <= 0) continue;
      if (remainingCents < minAmountCents) continue;
      const vendor = await this.vendors.getVendor(invoice.vendorId);
      rows.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        vendorName: vendor.name,
        status: invoice.status,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        totalCents,
        remainingCents,
        remainingDisplay: formatCents(remainingCents, invoice.currency),
      });
    }
    return {
      minAmountCents,
      count: rows.length,
      invoices: rows,
    };
  }

  private async getInvoicesByStatus(status: InvoiceStatus | null) {
    if (!status || !INVOICE_STATUSES.has(status)) {
      return {
        error:
          'Please specify a valid invoice status: draft, sent, partially_paid, paid, or overdue.',
      };
    }
    const invoices = await this.invoices.findAll(status);
    const rows = [];
    for (const invoice of invoices.slice(0, 25)) {
      const totalCents = await this.invoices.getTotalCents(invoice.id);
      const paidCents = await this.payments.getNetPaidCents(invoice.id);
      const vendor = await this.vendors.getVendor(invoice.vendorId);
      rows.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        vendorName: vendor.name,
        status: invoice.status,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        totalCents,
        remainingCents: totalCents - paidCents,
      });
    }
    return {
      status,
      count: invoices.length,
      showing: rows.length,
      invoices: rows,
    };
  }

  private async getVendorInvoices(vendorName: string) {
    const vendor = await this.findVendorByName(vendorName);
    if (!vendor) {
      return { error: `I couldn't find a vendor matching "${vendorName}".` };
    }
    const invoices = await this.invoices.findByVendorId(vendor.id);
    const rows = [];
    for (const invoice of invoices.slice(0, 25)) {
      const totalCents = await this.invoices.getTotalCents(invoice.id);
      const paidCents = await this.payments.getNetPaidCents(invoice.id);
      rows.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        totalCents,
        remainingCents: totalCents - paidCents,
      });
    }
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      count: invoices.length,
      invoices: rows,
    };
  }
}
