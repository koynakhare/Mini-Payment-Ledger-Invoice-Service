import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { GRAPHQL_OPERATIONS, RTK_TAG_TYPES } from '../../constants/apiEndpoints';
import type {
  Account,
  AccountStatementLine,
  ApplyPaymentInput,
  CreateAccountInput,
  CreateAccountPayload,
  CreateInvoiceInput,
  CreateVendorInput,
  Invoice,
  InvoiceStatus,
  LedgerIntegrityResult,
  Payment,
  Reversal,
  ReversePaymentInput,
  Vendor,
} from '../../types';
import { ACCOUNT_FIELDS, INVOICE_FIELDS, VENDOR_FIELDS } from './fragments';
import { graphqlRequest } from './graphqlClient';

const invalidationTags = [
  RTK_TAG_TYPES.INVOICE,
  RTK_TAG_TYPES.ACCOUNT,
  RTK_TAG_TYPES.VENDOR,
  RTK_TAG_TYPES.LEDGER_INTEGRITY,
] as const;

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    RTK_TAG_TYPES.ACCOUNT,
    RTK_TAG_TYPES.VENDOR,
    RTK_TAG_TYPES.INVOICE,
    RTK_TAG_TYPES.LEDGER_INTEGRITY,
  ],
  endpoints: (builder) => ({
    getAccounts: builder.query<Account[], void>({
      queryFn: async () => {
        try {
          const data = await graphqlRequest<{ accounts: Account[] }>(`
            query ${GRAPHQL_OPERATIONS.QUERIES.GET_ACCOUNTS} {
              accounts { ${ACCOUNT_FIELDS} }
            }
          `);
          return { data: data.accounts };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      providesTags: [RTK_TAG_TYPES.ACCOUNT],
    }),

    createAccount: builder.mutation<CreateAccountPayload, CreateAccountInput>({
      queryFn: async (input) => {
        try {
          const data = await graphqlRequest<{ createAccount: CreateAccountPayload }>(`
            mutation ${GRAPHQL_OPERATIONS.MUTATIONS.CREATE_ACCOUNT}($input: CreateAccountInput!) {
              createAccount(input: $input) {
                account { ${ACCOUNT_FIELDS} }
                error
              }
            }
          `, { input });
          return { data: data.createAccount };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      invalidatesTags: [RTK_TAG_TYPES.ACCOUNT],
    }),

    getAccountStatement: builder.query<AccountStatementLine[], string>({
      queryFn: async (accountId) => {
        try {
          const data = await graphqlRequest<{ accountStatement: AccountStatementLine[] }>(`
            query ${GRAPHQL_OPERATIONS.QUERIES.GET_ACCOUNT_STATEMENT}($accountId: ID!) {
              accountStatement(accountId: $accountId) {
                transactionId
                description
                entryType
                amountCents
                runningBalanceCents
                createdAt
                referenceType
                referenceId
              }
            }
          `, { accountId });
          return { data: data.accountStatement };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, accountId) => [
        { type: RTK_TAG_TYPES.ACCOUNT, id: accountId },
      ],
    }),

    getVendors: builder.query<Vendor[], void>({
      queryFn: async () => {
        try {
          const data = await graphqlRequest<{ vendors: Vendor[] }>(`
            query ${GRAPHQL_OPERATIONS.QUERIES.GET_VENDORS} {
              vendors { ${VENDOR_FIELDS} }
            }
          `);
          return { data: Array.isArray(data.vendors) ? data.vendors : [] };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      providesTags: [RTK_TAG_TYPES.VENDOR],
    }),

    createVendor: builder.mutation<Vendor, CreateVendorInput>({
      queryFn: async (input) => {
        try {
          const data = await graphqlRequest<{ createVendor: Vendor }>(`
            mutation ${GRAPHQL_OPERATIONS.MUTATIONS.CREATE_VENDOR}($input: CreateVendorInput!) {
              createVendor(input: $input) { ${VENDOR_FIELDS} }
            }
          `, { input });
          return { data: data.createVendor };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      invalidatesTags: [RTK_TAG_TYPES.VENDOR, RTK_TAG_TYPES.ACCOUNT],
    }),

    getLedgerIntegrity: builder.query<LedgerIntegrityResult, void>({
      queryFn: async () => {
        try {
          const data = await graphqlRequest<{ ledgerIntegrity: LedgerIntegrityResult }>(`
            query ${GRAPHQL_OPERATIONS.QUERIES.GET_LEDGER_INTEGRITY} {
              ledgerIntegrity {
                isBalanced
                transactionCount
                entryCount
                currencyBalances {
                  currency
                  totalDebitsCents
                  totalCreditsCents
                  isBalanced
                }
              }
            }
          `);
          return { data: data.ledgerIntegrity };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      providesTags: [RTK_TAG_TYPES.LEDGER_INTEGRITY],
    }),

    verifyLedgerIntegrity: builder.mutation<LedgerIntegrityResult, void>({
      queryFn: async () => {
        try {
          const data = await graphqlRequest<{ ledgerIntegrity: LedgerIntegrityResult }>(`
            query ${GRAPHQL_OPERATIONS.QUERIES.VERIFY_LEDGER_INTEGRITY} {
              ledgerIntegrity {
                isBalanced
                transactionCount
                entryCount
                currencyBalances {
                  currency
                  totalDebitsCents
                  totalCreditsCents
                  isBalanced
                }
              }
            }
          `);
          return { data: data.ledgerIntegrity };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      invalidatesTags: [RTK_TAG_TYPES.LEDGER_INTEGRITY],
    }),

    getInvoices: builder.query<Invoice[], InvoiceStatus | undefined>({
      queryFn: async (status) => {
        try {
          const data = await graphqlRequest<{ invoices: Invoice[] }>(`
            query ${GRAPHQL_OPERATIONS.QUERIES.GET_INVOICES}($status: InvoiceStatus) {
              invoices(status: $status) { ${INVOICE_FIELDS} }
            }
          `, { status: status ?? null });
          return { data: data.invoices };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      providesTags: [RTK_TAG_TYPES.INVOICE],
    }),

    getInvoice: builder.query<Invoice, string>({
      queryFn: async (id) => {
        try {
          const data = await graphqlRequest<{ invoice: Invoice }>(`
            query ${GRAPHQL_OPERATIONS.QUERIES.GET_INVOICE}($id: ID!) {
              invoice(id: $id) { ${INVOICE_FIELDS} }
            }
          `, { id });
          if (!data.invoice) {
            return { error: { message: 'Invoice not found' } };
          }
          return { data: data.invoice };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: RTK_TAG_TYPES.INVOICE, id }],
    }),

    createInvoice: builder.mutation<Invoice, CreateInvoiceInput>({
      queryFn: async (input) => {
        try {
          const data = await graphqlRequest<{ createInvoice: Invoice }>(`
            mutation ${GRAPHQL_OPERATIONS.MUTATIONS.CREATE_INVOICE}($input: CreateInvoiceInput!) {
              createInvoice(input: $input) { ${INVOICE_FIELDS} }
            }
          `, { input });
          return { data: data.createInvoice };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      invalidatesTags: [...invalidationTags],
    }),

    sendInvoice: builder.mutation<Invoice, string>({
      queryFn: async (invoiceId) => {
        try {
          const data = await graphqlRequest<{ sendInvoice: Invoice }>(`
            mutation ${GRAPHQL_OPERATIONS.MUTATIONS.SEND_INVOICE}($invoiceId: ID!) {
              sendInvoice(invoiceId: $invoiceId) { ${INVOICE_FIELDS} }
            }
          `, { invoiceId });
          return { data: data.sendInvoice };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      invalidatesTags: [...invalidationTags],
    }),

    markOverdueInvoices: builder.mutation<Invoice[], string | undefined>({
      queryFn: async (asOfDate) => {
        try {
          const data = await graphqlRequest<{ markOverdueInvoices: Invoice[] }>(`
            mutation ${GRAPHQL_OPERATIONS.MUTATIONS.MARK_OVERDUE_INVOICES}($asOfDate: String) {
              markOverdueInvoices(asOfDate: $asOfDate) { id invoiceNumber status }
            }
          `, { asOfDate: asOfDate ?? null });
          return { data: data.markOverdueInvoices };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      invalidatesTags: [RTK_TAG_TYPES.INVOICE],
    }),

    applyPayment: builder.mutation<Payment, ApplyPaymentInput>({
      queryFn: async (input) => {
        try {
          const data = await graphqlRequest<{ applyPayment: Payment }>(`
            mutation ${GRAPHQL_OPERATIONS.MUTATIONS.APPLY_PAYMENT}($input: ApplyPaymentInput!) {
              applyPayment(input: $input) {
                id
                invoiceId
                amountCents
                originalAmountCents
                originalCurrency
                exchangeRateUsed
                convertedAmountCents
                netAmountCents
                idempotencyKey
                transactionId
                createdAt
              }
            }
          `, { input });
          return { data: data.applyPayment };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      invalidatesTags: [...invalidationTags],
    }),

    reversePayment: builder.mutation<Reversal, ReversePaymentInput>({
      queryFn: async (input) => {
        try {
          const data = await graphqlRequest<{ reversePayment: Reversal }>(`
            mutation ${GRAPHQL_OPERATIONS.MUTATIONS.REVERSE_PAYMENT}($input: ReversePaymentInput!) {
              reversePayment(input: $input) {
                id
                paymentId
                amountCents
                reversalType
                reason
                createdAt
              }
            }
          `, { input });
          return { data: data.reversePayment };
        } catch (error) {
          return { error: { message: (error as Error).message } };
        }
      },
      invalidatesTags: [...invalidationTags],
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useCreateAccountMutation,
  useGetAccountStatementQuery,
  useGetLedgerIntegrityQuery,
  useVerifyLedgerIntegrityMutation,
  useGetVendorsQuery,
  useCreateVendorMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceMutation,
  useSendInvoiceMutation,
  useMarkOverdueInvoicesMutation,
  useApplyPaymentMutation,
  useReversePaymentMutation,
} = api;
