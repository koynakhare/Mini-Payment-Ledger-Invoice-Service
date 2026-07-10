import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import { AppError } from '../errors/AppError.js';
import { InvoiceRepository } from '../repositories/InvoiceRepository.js';
import { LedgerRepository } from '../repositories/LedgerRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import { SystemAccountService, VendorService } from './VendorService.js';
import { CURRENCY_CONFIG } from '../config/currencyConfig.js';
import { assertSupportedCurrency } from '../utils/convertCurrency.js';
import type {
  CreateInvoiceInput,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
} from '../types/index.js';

export class InvoiceService {
  private readonly invoices = new InvoiceRepository();
  private readonly payments = new PaymentRepository();
  private readonly ledger = new LedgerRepository();
  private readonly vendors = new VendorService();
  private readonly systemAccounts = new SystemAccountService();

  listInvoices(status?: InvoiceStatus): Invoice[] {
    return this.invoices.findAll(status);
  }

  getInvoice(id: string): Invoice {
    const invoice = this.invoices.findById(id);
    if (!invoice) {
      throw new AppError('NOT_FOUND', `Invoice not found: ${id}`);
    }
    return invoice;
  }

  getLineItems(invoiceId: string): InvoiceLineItem[] {
    this.getInvoice(invoiceId);
    return this.invoices.findLineItems(invoiceId);
  }

  getInvoiceTotalCents(invoiceId: string): number {
    return this.invoices.getTotalCents(invoiceId);
  }

  getRemainingBalanceCents(invoiceId: string): number {
    const total = this.invoices.getTotalCents(invoiceId);
    const paid = this.payments.getNetPaidCents(invoiceId);
    return total - paid;
  }

  createInvoice(input: CreateInvoiceInput): Invoice {
    const vendor = this.vendors.getVendor(input.vendorId);
    this.vendors.ensureVendorPayableAccount(vendor.id);

    if (isEmpty(trim(input.invoiceNumber))) {
      throw new AppError('VALIDATION_ERROR', 'Invoice number is required');
    }
    if (isEmpty(input.lineItems)) {
      throw new AppError('VALIDATION_ERROR', 'Invoice requires at least one line item');
    }
    if (isEmpty(trim(input.dueDate))) {
      throw new AppError('VALIDATION_ERROR', 'Due date is required');
    }

    for (const item of input.lineItems) {
      if (item.quantity <= 0 || item.unitPriceCents < 0) {
        throw new AppError('VALIDATION_ERROR', 'Invalid line item quantity or unit price');
      }
    }

    return this.invoices.create(
      vendor.id,
      trim(input.invoiceNumber),
      input.dueDate,
      input.lineItems,
      assertSupportedCurrency(input.currency ?? CURRENCY_CONFIG.DEFAULT_CURRENCY)
    );
  }

  sendInvoice(invoiceId: string): Invoice {
    const invoice = this.getInvoice(invoiceId);
    if (invoice.status !== 'draft') {
      throw new AppError('INVALID_STATUS', 'Only draft invoices can be sent');
    }

    const totalCents = this.invoices.getTotalCents(invoiceId);
    if (totalCents <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Invoice total must be greater than zero to send');
    }

    const vendorPayable = this.vendors.getVendorPayableAccount(invoice.vendorId);
    const expenseAccount = this.systemAccounts.getExpenseAccount();

    this.ledger.createTransaction(
      `Invoice ${invoice.invoiceNumber} posted`,
      [
        { accountId: expenseAccount.id, amountCents: totalCents, entryType: 'debit', currency: invoice.currency },
        { accountId: vendorPayable.id, amountCents: totalCents, entryType: 'credit', currency: invoice.currency },
      ],
      'invoice',
      invoiceId
    );

    return this.invoices.updateStatus(invoiceId, 'sent');
  }

  resolveStatusFromPayment(invoiceId: string): InvoiceStatus {
    const remaining = this.getRemainingBalanceCents(invoiceId);
    const total = this.invoices.getTotalCents(invoiceId);
    const invoice = this.getInvoice(invoiceId);

    if (remaining <= 0) {
      return 'paid';
    }
    if (remaining < total) {
      return 'partially_paid';
    }
    if (invoice.status === 'overdue') {
      return 'overdue';
    }
    return 'sent';
  }

  markOverdueInvoices(asOfDate?: string): Invoice[] {
    const date = asOfDate ?? new Date().toISOString().split('T')[0];
    const candidates = this.invoices.findOverdueCandidates(date);
    const updated: Invoice[] = [];

    for (const invoice of candidates) {
      const remaining = this.getRemainingBalanceCents(invoice.id);
      if (remaining > 0) {
        updated.push(this.invoices.updateStatus(invoice.id, 'overdue'));
      }
    }

    return updated;
  }
}
