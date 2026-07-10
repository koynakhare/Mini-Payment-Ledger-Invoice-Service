export const ROUTE_PATHS = {
  DASHBOARD: '/',
  ACCOUNTS: '/accounts',
  ACCOUNT_STATEMENT: (accountId: string) => `/accounts/${accountId}`,
  INVOICES: '/invoices',
  INVOICE_DETAIL: (invoiceId: string) => `/invoices/${invoiceId}`,
} as const;

export const ROUTE_SEGMENTS = {
  ACCOUNTS: 'accounts',
  INVOICES: 'invoices',
  ACCOUNT_ID: ':accountId',
  INVOICE_ID: ':invoiceId',
} as const;

export const ROUTE_KEYS = {
  DASHBOARD: 'dashboard',
  ACCOUNTS: 'accounts',
  ACCOUNT_STATEMENT: 'accountStatement',
  INVOICES: 'invoices',
  INVOICE_DETAIL: 'invoiceDetail',
} as const;
