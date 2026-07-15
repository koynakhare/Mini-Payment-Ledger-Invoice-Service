import type { CurrencyCode } from '../config/currencyConfig.js';

export type EntryType = 'debit' | 'credit';

export type AccountType = 'COMPANY_BANK' | 'VENDOR_PAYABLE' | 'EXPENSE';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue';

export type ReversalType = 'refund' | 'void';

export type UserRole = 'VIEWER' | 'APPROVER';

export type { CurrencyCode };

export type { AuthUser, User } from '../auth/types.js';

export interface Vendor {
  id: string;
  name: string;
  contactInfo: string | null;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  accountType: AccountType;
  vendorId: string | null;
  createdAt: string;
}

export interface CreateAccountInput {
  name: string;
  accountType: AccountType;
}

export interface CreateAccountPayload {
  account: Account | null;
  error: string | null;
}

export interface Transaction {
  id: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  amountCents: number;
  entryType: EntryType;
  currency: CurrencyCode;
  createdAt: string;
}

export interface Invoice {
  id: string;
  vendorId: string;
  invoiceNumber: string;
  currency: CurrencyCode;
  status: InvoiceStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  transactionId: string;
  amountCents: number;
  originalAmountCents: number;
  originalCurrency: CurrencyCode;
  exchangeRateUsed: number | null;
  convertedAmountCents: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface Reversal {
  id: string;
  paymentId: string;
  transactionId: string;
  amountCents: number;
  reversalType: ReversalType;
  idempotencyKey: string;
  reason: string | null;
  createdAt: string;
}

export interface CurrencyLedgerBalance {
  currency: CurrencyCode;
  totalDebitsCents: number;
  totalCreditsCents: number;
  isBalanced: boolean;
}

export interface LedgerIntegrityResult {
  isBalanced: boolean;
  transactionCount: number;
  entryCount: number;
  currencyBalances: CurrencyLedgerBalance[];
}

export interface AccountStatementLine {
  transactionId: string;
  description: string;
  entryType: EntryType;
  amountCents: number;
  runningBalanceCents: number;
  createdAt: string;
  referenceType: string | null;
  referenceId: string | null;
}

export interface CreateVendorInput {
  name: string;
  contactInfo?: string;
}

export interface CreateTransactionInput {
  description: string;
  entries: Array<{
    accountId: string;
    amountCents: number;
    entryType: EntryType;
    currency?: CurrencyCode;
  }>;
  referenceType?: string;
  referenceId?: string;
}

export interface CreateInvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CreateInvoiceInput {
  vendorId: string;
  invoiceNumber: string;
  dueDate: string;
  currency?: CurrencyCode;
  lineItems: CreateInvoiceLineItemInput[];
}

export interface ApplyPaymentInput {
  invoiceId: string;
  amountCents: number;
  currency?: CurrencyCode;
  idempotencyKey: string;
}

export interface ReversePaymentInput {
  paymentId: string;
  reversalType: ReversalType;
  idempotencyKey: string;
  reason?: string;
}
