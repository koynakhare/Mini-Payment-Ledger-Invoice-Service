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

  async listInvoices(status?: InvoiceStatus): Promise<Invoice[]> {
    return this.invoices.findAll(status);
  }

  async getInvoice(id: string): Promise<Invoice> {
    const invoice = await this.invoices.findById(id);
    if (!invoice) {
      throw new AppError('NOT_FOUND', `Invoice not found: ${id}`);
    }
    return invoice;
  }

  async getLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    await this.getInvoice(invoiceId);
    return this.invoices.findLineItems(invoiceId);
  }

  async getInvoiceTotalCents(invoiceId: string): Promise<number> {
    return this.invoices.getTotalCents(invoiceId);
  }

  async getRemainingBalanceCents(invoiceId: string): Promise<number> {
    const total = await this.invoices.getTotalCents(invoiceId);
    const paid = await this.payments.getNetPaidCents(invoiceId);
    return total - paid;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const vendor = await this.vendors.getVendor(input.vendorId);
    await this.vendors.ensureVendorPayableAccount(vendor.id);

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

  async sendInvoice(invoiceId: string, vendorEmail: string): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId);
    if (invoice.status !== 'draft') {
      throw new AppError('INVALID_STATUS', 'Only draft invoices can be sent');
    }

    await this.vendors.updateContactInfo(invoice.vendorId, vendorEmail);

    const totalCents = await this.invoices.getTotalCents(invoiceId);
    if (totalCents <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Invoice total must be greater than zero to send');
    }

    const vendorPayable = await this.vendors.getVendorPayableAccount(invoice.vendorId);
    const expenseAccount = await this.systemAccounts.getExpenseAccount();

    await this.ledger.createTransaction(
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

  async resolveStatusFromPayment(invoiceId: string): Promise<InvoiceStatus> {
    const remaining = await this.getRemainingBalanceCents(invoiceId);
    const total = await this.invoices.getTotalCents(invoiceId);
    const invoice = await this.getInvoice(invoiceId);

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

  async markOverdueInvoices(asOfDate?: string): Promise<Invoice[]> {
    const date = asOfDate ?? new Date().toISOString().split('T')[0];
    const candidates = await this.invoices.findOverdueCandidates(date);
    const updated: Invoice[] = [];

    for (const invoice of candidates) {
      const remaining = await this.getRemainingBalanceCents(invoice.id);
      if (remaining > 0) {
        updated.push(await this.invoices.updateStatus(invoice.id, 'overdue'));
      }
    }

    return updated;
  }
}
