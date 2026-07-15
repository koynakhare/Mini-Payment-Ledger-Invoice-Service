import { GRAPHQL_OPERATIONS } from '../../constants/apiEndpoints';
import type { InvoiceExtractionDraft } from '../../types';
import { baseApi } from '../../api/baseApi';
import { gqlQuery, graphqlEndpoint } from '../../api/graphql/endpointHelpers';

export interface ExtractInvoiceInput {
  documentText?: string;
  documentBase64?: string;
  mimeType?: string;
}

export const extractionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    extractInvoiceFromDocument: builder.mutation<InvoiceExtractionDraft, ExtractInvoiceInput>({
      queryFn: graphqlEndpoint<
        ExtractInvoiceInput,
        { extractInvoiceFromDocument: InvoiceExtractionDraft },
        InvoiceExtractionDraft
      >(
        (input) => ({
          document: gqlQuery(
            GRAPHQL_OPERATIONS.QUERIES.EXTRACT_INVOICE_FROM_DOCUMENT,
            `extractInvoiceFromDocument(
              documentText: $documentText
              documentBase64: $documentBase64
              mimeType: $mimeType
            ) {
              available
              message
              vendorName
              matchedVendorId
              invoiceNumber
              dueDate
              currency
              lineItems { description quantity unitPriceCents confidence }
              missingFields
              aiFilledFields
            }`,
            '$documentText: String, $documentBase64: String, $mimeType: String'
          ),
          variables: { ...input },
        }),
        (data) => data.extractInvoiceFromDocument
      ),
    }),
  }),
});

export const { useExtractInvoiceFromDocumentMutation } = extractionApi;
