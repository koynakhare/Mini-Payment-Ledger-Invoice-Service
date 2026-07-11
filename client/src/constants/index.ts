import type { InvoiceStatus } from '../types';

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const satisfies Record<string, InvoiceStatus>;

export const INVOICE_STATUS_FILTER_ALL = 'all' as const;

export const PAYABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  INVOICE_STATUS.SENT,
  INVOICE_STATUS.PARTIALLY_PAID,
  INVOICE_STATUS.OVERDUE,
];

export const ACCOUNT_TYPES = {
  COMPANY_BANK: 'COMPANY_BANK',
  VENDOR_PAYABLE: 'VENDOR_PAYABLE',
  EXPENSE: 'EXPENSE',
} as const;

export const ACCOUNT_TYPE_OPTIONS = [
  { value: ACCOUNT_TYPES.VENDOR_PAYABLE, label: 'Vendor Payable' },
  { value: ACCOUNT_TYPES.COMPANY_BANK, label: 'Company Bank' },
  { value: ACCOUNT_TYPES.EXPENSE, label: 'Expense' },
] as const;

export const ACCOUNT_TYPE_DESCRIPTIONS = {
  COMPANY_BANK: 'Money your company has paid out to vendors (cash leaving your bank)',
  VENDOR_PAYABLE: 'Money your company still owes that vendor',
} as const;

export const STATUS_FILTER_OPTIONS: Array<{
  label: string;
  value: InvoiceStatus | typeof INVOICE_STATUS_FILTER_ALL;
}> = [
  { label: 'All', value: INVOICE_STATUS_FILTER_ALL },
  { label: 'Draft', value: INVOICE_STATUS.DRAFT },
  { label: 'Sent', value: INVOICE_STATUS.SENT },
  { label: 'Partially Paid', value: INVOICE_STATUS.PARTIALLY_PAID },
  { label: 'Paid', value: INVOICE_STATUS.PAID },
  { label: 'Overdue', value: INVOICE_STATUS.OVERDUE },
];

export const NAV_ITEMS = [
  { label: 'Dashboard', key: 'dashboard' as const },
  { label: 'Accounts', key: 'accounts' as const },
  { label: 'Invoices', key: 'invoices' as const },
];

export const LAYOUT = {
  DRAWER_WIDTH: 248,
} as const;

export const TABLE_DEFAULTS = {
  SKELETON_ROWS: 5,
  SKELETON_COLUMNS: 5,
} as const;
