export const ROUTE_PATHS = {
  LOGIN: '/login',
  DASHBOARD: '/',
  ACCOUNTS: '/accounts',
  ACCOUNT_STATEMENT: (accountId: string) => `/accounts/${accountId}`,
  INVOICES: '/invoices',
  INVOICE_DETAIL: (invoiceId: string) => `/invoices/${invoiceId}`,
  ASSISTANT: '/assistant',
} as const;

export const ROUTE_SEGMENTS = {
  LOGIN: 'login',
  ACCOUNTS: 'accounts',
  INVOICES: 'invoices',
  ACCOUNT_ID: ':accountId',
  INVOICE_ID: ':invoiceId',
  ASSISTANT: 'assistant',
} as const;

export const ROUTE_KEYS = {
  LOGIN: 'login',
  DASHBOARD: 'dashboard',
  ACCOUNTS: 'accounts',
  ACCOUNT_STATEMENT: 'accountStatement',
  INVOICES: 'invoices',
  INVOICE_DETAIL: 'invoiceDetail',
  ASSISTANT: 'assistant',
} as const;
