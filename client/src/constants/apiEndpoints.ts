export const GRAPHQL_BASE_URL = import.meta.env.VITE_GRAPHQL_URL ?? '/graphql';

/** Same-origin PDF route (Vite proxy in dev, Vercel rewrite in production). */
export function getInvoicePdfUrl(invoiceId: string): string {
  return `/invoices/${invoiceId}/pdf`;
}

export const GRAPHQL_OPERATIONS = {
  QUERIES: {
    GET_ACCOUNTS: 'GetAccounts',
    GET_ACCOUNT_STATEMENT: 'GetAccountStatement',
    GET_LEDGER_INTEGRITY: 'GetLedgerIntegrity',
    VERIFY_LEDGER_INTEGRITY: 'VerifyLedgerIntegrity',
    GET_VENDORS: 'GetVendors',
    GET_INVOICES: 'GetInvoices',
    GET_INVOICE: 'GetInvoice',
  },
  MUTATIONS: {
    CREATE_VENDOR: 'CreateVendor',
    CREATE_ACCOUNT: 'CreateAccount',
    CREATE_INVOICE: 'CreateInvoice',
    SEND_INVOICE: 'SendInvoice',
    APPLY_PAYMENT: 'ApplyPayment',
    REVERSE_PAYMENT: 'ReversePayment',
    MARK_OVERDUE_INVOICES: 'MarkOverdueInvoices',
  },
} as const;

export const RTK_TAG_TYPES = {
  ACCOUNT: 'Account',
  VENDOR: 'Vendor',
  INVOICE: 'Invoice',
  LEDGER_INTEGRITY: 'LedgerIntegrity',
} as const;
