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

export type ComplianceFlagType =
  | 'DUPLICATE_INVOICE'
  | 'AMOUNT_ANOMALY'
  | 'DATE_MISMATCH'
  | 'VELOCITY_ANOMALY'
  | 'OTHER';

export type ComplianceSeverity = 'info' | 'low' | 'medium' | 'high';

export type CurrencyCode = 'USD' | 'INR';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthPayload {
  token: string;
  user: AuthUser;
}

export interface ComplianceFlag {
  type: ComplianceFlagType;
  severity: ComplianceSeverity;
  rationale: string;
}

export interface ComplianceReview {
  available: boolean;
  summary: string;
  flags: ComplianceFlag[];
}

export interface LedgerAssistantAnswer {
  answered: boolean;
  operation: string;
  answer: string;
}

export interface ExtractedLineItemDraft {
  description: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
  confidence: string;
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

export interface Vendor {
  id: string;
  name: string;
  contactInfo: string | null;
  createdAt: string;
  payableAccount: Account;
}

export interface Account {
  id: string;
  name: string;
  accountType: AccountType;
  vendorId: string | null;
  balanceCents: number;
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
  netAmountCents: number;
  idempotencyKey: string;
  createdAt: string;
  reversals: Reversal[];
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

export interface Invoice {
  id: string;
  vendorId: string;
  vendor: Vendor;
  vendorAccount: Account;
  invoiceNumber: string;
  currency: CurrencyCode;
  status: InvoiceStatus;
  dueDate: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  lineItems: InvoiceLineItem[];
  payments: Payment[];
  reversals: Reversal[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CreateVendorInput {
  name: string;
  contactInfo?: string;
}

export interface CreateAccountInput {
  name: string;
  accountType: AccountType;
}

export interface CreateAccountPayload {
  account: Account | null;
  error: string | null;
}

export interface CreateInvoiceInput {
  vendorId: string;
  invoiceNumber: string;
  dueDate: string;
  currency?: CurrencyCode;
  lineItems: InvoiceLineItemInput[];
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
