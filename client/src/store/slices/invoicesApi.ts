import { GRAPHQL_OPERATIONS, RTK_TAG_TYPES } from '../../constants/apiEndpoints';
import type { CreateInvoiceInput, Invoice, InvoiceStatus } from '../../types';
import { baseApi, invalidationTags } from '../../api/baseApi';
import { ApiError } from '../../api/graphql/errors';
import {
  gqlMutation,
  gqlQuery,
  graphqlEndpoint,
} from '../../api/graphql/endpointHelpers';
import { INVOICE_FIELDS } from '../../api/graphql/fragments';

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInvoices: builder.query<Invoice[], InvoiceStatus | undefined>({
      queryFn: graphqlEndpoint<
        InvoiceStatus | undefined,
        { invoices: Invoice[] },
        Invoice[]
      >(
        (status) => ({
          document: gqlQuery(
            GRAPHQL_OPERATIONS.QUERIES.GET_INVOICES,
            `invoices(status: $status) { ${INVOICE_FIELDS} }`,
            '$status: InvoiceStatus'
          ),
          variables: { status: status ?? null },
        }),
        (data) => data.invoices
      ),
      providesTags: [RTK_TAG_TYPES.INVOICE],
    }),

    getInvoice: builder.query<Invoice, string>({
      queryFn: graphqlEndpoint<string, { invoice: Invoice | null }, Invoice>(
        (id) => ({
          document: gqlQuery(
            GRAPHQL_OPERATIONS.QUERIES.GET_INVOICE,
            `invoice(id: $id) { ${INVOICE_FIELDS} }`,
            '$id: ID!'
          ),
          variables: { id },
        }),
        (data) => {
          if (!data.invoice) {
            throw new ApiError({ code: 'NOT_FOUND', message: 'Invoice not found' });
          }
          return data.invoice;
        }
      ),
      providesTags: (_result, _error, id) => [{ type: RTK_TAG_TYPES.INVOICE, id }],
    }),

    createInvoice: builder.mutation<Invoice, CreateInvoiceInput>({
      queryFn: graphqlEndpoint<
        CreateInvoiceInput,
        { createInvoice: Invoice },
        Invoice
      >(
        (input) => ({
          document: gqlMutation(
            GRAPHQL_OPERATIONS.MUTATIONS.CREATE_INVOICE,
            `createInvoice(input: $input) { ${INVOICE_FIELDS} }`,
            '$input: CreateInvoiceInput!'
          ),
          variables: { input },
        }),
        (data) => data.createInvoice
      ),
      invalidatesTags: [...invalidationTags],
    }),

    sendInvoice: builder.mutation<Invoice, { invoiceId: string; vendorEmail: string }>({
      queryFn: graphqlEndpoint<
        { invoiceId: string; vendorEmail: string },
        { sendInvoice: Invoice },
        Invoice
      >(
        ({ invoiceId, vendorEmail }) => ({
          document: gqlMutation(
            GRAPHQL_OPERATIONS.MUTATIONS.SEND_INVOICE,
            `sendInvoice(invoiceId: $invoiceId, vendorEmail: $vendorEmail) { ${INVOICE_FIELDS} }`,
            '$invoiceId: ID!, $vendorEmail: String!'
          ),
          variables: { invoiceId, vendorEmail },
        }),
        (data) => data.sendInvoice
      ),
      invalidatesTags: [...invalidationTags, RTK_TAG_TYPES.VENDOR],
    }),

    markOverdueInvoices: builder.mutation<Invoice[], string | undefined>({
      queryFn: graphqlEndpoint<
        string | undefined,
        { markOverdueInvoices: Invoice[] },
        Invoice[]
      >(
        (asOfDate) => ({
          document: gqlMutation(
            GRAPHQL_OPERATIONS.MUTATIONS.MARK_OVERDUE_INVOICES,
            'markOverdueInvoices(asOfDate: $asOfDate) { id invoiceNumber status }',
            '$asOfDate: String'
          ),
          variables: { asOfDate: asOfDate ?? null },
        }),
        (data) => data.markOverdueInvoices
      ),
      invalidatesTags: [RTK_TAG_TYPES.INVOICE],
    }),
  }),
});

export const {
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceMutation,
  useSendInvoiceMutation,
  useMarkOverdueInvoicesMutation,
} = invoicesApi;
