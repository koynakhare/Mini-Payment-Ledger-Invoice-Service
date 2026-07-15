import { LlmClientError, llmGenerate, type JsonSchema } from '../llm/index.js';
import { InvoiceRepository } from '../repositories/InvoiceRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import { VendorService } from './VendorService.js';
import { AppError } from '../errors/AppError.js';

export type ComplianceFlagType =
  | 'DUPLICATE_INVOICE'
  | 'AMOUNT_ANOMALY'
  | 'DATE_MISMATCH'
  | 'VELOCITY_ANOMALY'
  | 'OTHER';

export type ComplianceSeverity = 'info' | 'low' | 'medium' | 'high';

export interface ComplianceFlag {
  type: ComplianceFlagType;
  severity: ComplianceSeverity;
  rationale: string;
}

export interface ComplianceReviewResult {
  available: boolean;
  summary: string;
  flags: ComplianceFlag[];
}

const FLAG_TYPES = new Set<ComplianceFlagType>([
  'DUPLICATE_INVOICE',
  'AMOUNT_ANOMALY',
  'DATE_MISMATCH',
  'VELOCITY_ANOMALY',
  'OTHER',
]);

const SEVERITIES = new Set<ComplianceSeverity>(['info', 'low', 'medium', 'high']);

export const COMPLIANCE_RESPONSE_SCHEMA: JsonSchema = {
  type: 'OBJECT',
  properties: {
    flags: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: {
            type: 'STRING',
            enum: [
              'DUPLICATE_INVOICE',
              'AMOUNT_ANOMALY',
              'DATE_MISMATCH',
              'VELOCITY_ANOMALY',
              'OTHER',
            ],
          },
          severity: {
            type: 'STRING',
            enum: ['info', 'low', 'medium', 'high'],
          },
          rationale: { type: 'STRING' },
        },
        required: ['type', 'severity', 'rationale'],
      },
    },
    summary: { type: 'STRING' },
  },
  required: ['flags', 'summary'],
};

function unavailable(message: string): ComplianceReviewResult {
  return {
    available: false,
    summary: message,
    flags: [],
  };
}

export function parseComplianceResponse(raw: unknown): ComplianceReviewResult {
  if (!raw || typeof raw !== 'object') {
    return unavailable('AI review unavailable: malformed response.');
  }

  const record = raw as { flags?: unknown; summary?: unknown };
  const flagsRaw = Array.isArray(record.flags) ? record.flags : [];
  const flags: ComplianceFlag[] = [];

  for (const entry of flagsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const flag = entry as Record<string, unknown>;
    const type = String(flag.type ?? '') as ComplianceFlagType;
    const severity = String(flag.severity ?? '') as ComplianceSeverity;
    const rationale = typeof flag.rationale === 'string' ? flag.rationale.trim() : '';
    if (!FLAG_TYPES.has(type) || !SEVERITIES.has(severity) || !rationale) {
      continue;
    }
    flags.push({ type, severity, rationale });
  }

  const summary =
    typeof record.summary === 'string' && record.summary.trim()
      ? record.summary.trim()
      : flags.length
        ? `Identified ${flags.length} compliance flag(s) for review.`
        : 'No compliance flags identified.';

  return {
    available: true,
    summary,
    flags,
  };
}

function formatMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

export function buildCompliancePrompt(context: {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    currency: string;
    dueDate: string;
    totalCents: number;
    remainingCents: number;
    createdAt: string;
  };
  vendor: { id: string; name: string };
  lineItems: Array<{ description: string; quantity: number; unitPriceCents: number; amountCents: number }>;
  payments: Array<{ amountCents: number; createdAt: string }>;
  pendingPaymentAmountCents?: number | null;
  vendorInvoiceHistory: Array<{
    invoiceNumber: string;
    status: string;
    totalCents: number;
    dueDate: string;
    createdAt: string;
  }>;
}): string {
  const currency = context.invoice.currency;
  const invoiceForPrompt = {
    ...context.invoice,
    totalDisplay: formatMoney(context.invoice.totalCents, currency),
    remainingDisplay: formatMoney(context.invoice.remainingCents, currency),
  };
  const lineItemsForPrompt = context.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceDisplay: formatMoney(item.unitPriceCents, currency),
    amountDisplay: formatMoney(item.amountCents, currency),
  }));
  const paymentsForPrompt = context.payments.map((payment) => ({
    amountDisplay: formatMoney(payment.amountCents, currency),
    createdAt: payment.createdAt,
  }));
  const historyForPrompt = context.vendorInvoiceHistory.map((entry) => ({
    invoiceNumber: entry.invoiceNumber,
    status: entry.status,
    totalDisplay: formatMoney(entry.totalCents, currency),
    dueDate: entry.dueDate,
    createdAt: entry.createdAt,
  }));
  const pendingDisplay =
    context.pendingPaymentAmountCents == null
      ? 'not specified'
      : formatMoney(context.pendingPaymentAmountCents, currency);

  return [
    'You are an accounts-payable compliance assistant for a transportation management system.',
    'Review the pending payment context and return structured risk flags only.',
    'Do not approve, reject, or execute any payment. A human approver decides.',
    'Flag types: DUPLICATE_INVOICE, AMOUNT_ANOMALY, DATE_MISMATCH, VELOCITY_ANOMALY, OTHER.',
    'Severity: info, low, medium, high. Use plain-language rationales.',
    'IMPORTANT: In summary and rationale text, always express money using the invoice currency display values',
    `(e.g. "${currency} 300.00"). Never mention cents, paise, or integer minor units.`,
    'If nothing looks suspicious, return an empty flags array and a short summary.',
    '',
    'Invoice under review:',
    JSON.stringify(invoiceForPrompt, null, 2),
    '',
    'Vendor:',
    JSON.stringify(context.vendor, null, 2),
    '',
    'Line items:',
    JSON.stringify(lineItemsForPrompt, null, 2),
    '',
    'Existing payments on this invoice:',
    JSON.stringify(paymentsForPrompt, null, 2),
    '',
    'Proposed payment amount (invoice currency):',
    pendingDisplay,
    '',
    'Other invoices for this vendor (recent):',
    JSON.stringify(historyForPrompt, null, 2),
  ].join('\n');
}

export class ComplianceReviewService {
  constructor(
    private readonly invoices = new InvoiceRepository(),
    private readonly payments = new PaymentRepository(),
    private readonly vendors = new VendorService()
  ) {}

  async reviewPayment(
    invoiceId: string,
    pendingPaymentAmountCents?: number | null
  ): Promise<ComplianceReviewResult> {
    const invoice = await this.invoices.findById(invoiceId);
    if (!invoice) {
      throw new AppError('NOT_FOUND', `Invoice not found: ${invoiceId}`);
    }

    const vendor = await this.vendors.getVendor(invoice.vendorId);
    const lineItems = await this.invoices.findLineItems(invoiceId);
    const payments = await this.payments.findByInvoiceId(invoiceId);
    const totalCents = await this.invoices.getTotalCents(invoiceId);
    const paidCents = await this.payments.getNetPaidCents(invoiceId);
    const remainingCents = totalCents - paidCents;

    const vendorInvoices = await this.invoices.findByVendorId(invoice.vendorId);
    const vendorInvoiceHistory = await Promise.all(
      vendorInvoices
        .filter((entry) => entry.id !== invoice.id)
        .slice(0, 10)
        .map(async (entry) => ({
          invoiceNumber: entry.invoiceNumber,
          status: entry.status,
          totalCents: await this.invoices.getTotalCents(entry.id),
          dueDate: entry.dueDate,
          createdAt: entry.createdAt,
        }))
    );

    const prompt = buildCompliancePrompt({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        totalCents,
        remainingCents,
        createdAt: invoice.createdAt,
      },
      vendor: { id: vendor.id, name: vendor.name },
      lineItems: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        amountCents: item.amountCents,
      })),
      payments: payments.map((payment) => ({
        amountCents: payment.convertedAmountCents,
        createdAt: payment.createdAt,
      })),
      pendingPaymentAmountCents,
      vendorInvoiceHistory,
    });

    try {
      const raw = await llmGenerate({
        prompt,
        responseSchema: COMPLIANCE_RESPONSE_SCHEMA,
      });
      return parseComplianceResponse(raw);
    } catch (error) {
      if (error instanceof LlmClientError) {
        return unavailable(`AI review unavailable: ${error.message}`);
      }
      return unavailable('AI review unavailable due to an unexpected error.');
    }
  }
}
