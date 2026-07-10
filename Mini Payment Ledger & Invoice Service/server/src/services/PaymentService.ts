import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import { runInTransaction } from '../db/connection.js';
import { CURRENCY_CONFIG } from '../config/currencyConfig.js';
import { AppError } from '../errors/AppError.js';
import { InvoiceRepository } from '../repositories/InvoiceRepository.js';
import { LedgerRepository } from '../repositories/LedgerRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import {
  assertSupportedCurrency,
  convertCurrency,
  resolveExchangeRateUsed,
} from '../utils/convertCurrency.js';
import { InvoiceService } from './InvoiceService.js';
import { SystemAccountService, VendorService } from './VendorService.js';
import type { ApplyPaymentInput, CurrencyCode, Payment, ReversePaymentInput, Reversal } from '../types/index.js';
import type { CreateLedgerEntryInput } from '../repositories/LedgerRepository.js';

export class PaymentService {
  private readonly payments = new PaymentRepository();
  private readonly invoices = new InvoiceRepository();
  private readonly ledger = new LedgerRepository();
  private readonly invoiceService = new InvoiceService();
  private readonly vendors = new VendorService();
  private readonly systemAccounts = new SystemAccountService();

  getPaymentsForInvoice(invoiceId: string): Payment[] {
    this.invoiceService.getInvoice(invoiceId);
    return this.payments.findByInvoiceId(invoiceId);
  }

  getReversalsForInvoice(invoiceId: string): Reversal[] {
    this.invoiceService.getInvoice(invoiceId);
    return this.payments.findReversalsByInvoiceId(invoiceId);
  }

  applyPayment(input: ApplyPaymentInput): Payment {
    const idempotencyKey = trim(input.idempotencyKey);
    if (isEmpty(idempotencyKey)) {
      throw new AppError('VALIDATION_ERROR', 'Idempotency key is required');
    }
    if (input.amountCents <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Payment amount must be positive');
    }

    const existing = this.payments.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    return runInTransaction(() => {
      const invoice = this.invoices.findByIdForUpdate(input.invoiceId);
      if (!invoice) {
        throw new AppError('NOT_FOUND', `Invoice not found: ${input.invoiceId}`);
      }

      if (!['sent', 'partially_paid', 'overdue'].includes(invoice.status)) {
        throw new AppError('INVALID_STATUS', `Cannot pay invoice in status: ${invoice.status}`);
      }

      const duplicate = this.payments.findByIdempotencyKey(idempotencyKey);
      if (duplicate) {
        return duplicate;
      }

      const originalCurrency = assertSupportedCurrency(
        input.currency ?? CURRENCY_CONFIG.DEFAULT_CURRENCY
      );
      const invoiceCurrency = invoice.currency;
      const originalAmountCents = input.amountCents;
      const convertedAmountCents = convertCurrency(
        originalAmountCents,
        originalCurrency,
        invoiceCurrency
      );
      const exchangeRateUsed = resolveExchangeRateUsed(originalCurrency, invoiceCurrency);

      const totalCents = this.invoices.getTotalCents(input.invoiceId);
      const netPaid = this.payments.getNetPaidCents(input.invoiceId);
      const remaining = totalCents - netPaid;

      if (convertedAmountCents > remaining) {
        throw new AppError(
          'OVERPAYMENT',
          `Payment exceeds remaining balance of ${remaining} cents in ${invoiceCurrency}`,
          {
            remainingCents: remaining,
            attemptedCents: convertedAmountCents,
            invoiceCurrency,
            originalAmountCents,
            originalCurrency,
          }
        );
      }

      const vendorPayable = this.vendors.getVendorPayableAccount(invoice.vendorId);
      const companyBank = this.systemAccounts.getCompanyBankAccount();

      const entries = this.buildPaymentEntries(
        vendorPayable.id,
        companyBank.id,
        convertedAmountCents,
        invoiceCurrency
      );

      const transaction = this.ledger.insertTransaction(
        `Payment on invoice ${invoice.invoiceNumber}`,
        entries,
        'payment',
        input.invoiceId
      );

      const payment = this.payments.create({
        invoiceId: input.invoiceId,
        transactionId: transaction.id,
        convertedAmountCents,
        originalAmountCents,
        originalCurrency,
        exchangeRateUsed,
        idempotencyKey,
      });

      const newStatus = this.invoiceService.resolveStatusFromPayment(input.invoiceId);
      this.invoices.updateStatus(input.invoiceId, newStatus);

      return payment;
    });
  }

  reversePayment(input: ReversePaymentInput): Reversal {
    const idempotencyKey = trim(input.idempotencyKey);
    if (isEmpty(idempotencyKey)) {
      throw new AppError('VALIDATION_ERROR', 'Idempotency key is required');
    }

    const existing = this.payments.findReversalByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    const payment = this.payments.findById(input.paymentId);
    if (!payment) {
      throw new AppError('NOT_FOUND', `Payment not found: ${input.paymentId}`);
    }

    const netRemaining = this.payments.getNetPaidForPayment(input.paymentId);
    if (netRemaining <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Payment has already been fully reversed');
    }

    const invoice = this.invoices.findById(payment.invoiceId);
    if (!invoice) {
      throw new AppError('NOT_FOUND', `Invoice not found for payment`);
    }

    const vendorPayable = this.vendors.getVendorPayableAccount(invoice.vendorId);
    const companyBank = this.systemAccounts.getCompanyBankAccount();

    const reversalAmount = netRemaining;
    const label =
      input.reversalType === 'void'
        ? `Void payment on invoice ${invoice.invoiceNumber}`
        : `Refund payment on invoice ${invoice.invoiceNumber}`;

    const entries = this.buildRefundEntries(
      vendorPayable.id,
      companyBank.id,
      reversalAmount,
      invoice.currency
    );

    const transaction = this.ledger.insertTransaction(
      label,
      entries,
      input.reversalType,
      payment.id
    );

    const reversal = this.payments.createReversal(
      payment.id,
      transaction.id,
      reversalAmount,
      input.reversalType,
      idempotencyKey,
      input.reason
    );

    const newStatus = this.invoiceService.resolveStatusFromPayment(invoice.id);
    this.invoices.updateStatus(invoice.id, newStatus);

    return reversal;
  }

  private buildPaymentEntries(
    vendorPayableAccountId: string,
    companyBankAccountId: string,
    amountCents: number,
    currency: CurrencyCode
  ): CreateLedgerEntryInput[] {
    const entries: CreateLedgerEntryInput[] = [
      { accountId: vendorPayableAccountId, amountCents, entryType: 'debit', currency },
      { accountId: companyBankAccountId, amountCents, entryType: 'credit', currency },
    ];
    LedgerRepository.validateBalancedEntries(entries);
    return entries;
  }

  private buildRefundEntries(
    vendorPayableAccountId: string,
    companyBankAccountId: string,
    amountCents: number,
    currency: CurrencyCode
  ): CreateLedgerEntryInput[] {
    const entries: CreateLedgerEntryInput[] = [
      { accountId: companyBankAccountId, amountCents, entryType: 'debit', currency },
      { accountId: vendorPayableAccountId, amountCents, entryType: 'credit', currency },
    ];
    LedgerRepository.validateBalancedEntries(entries);
    return entries;
  }
}
