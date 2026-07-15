import { GRAPHQL_OPERATIONS } from '../../constants/apiEndpoints';
import type { ComplianceReview } from '../../types';
import { baseApi } from '../../api/baseApi';
import { gqlQuery, graphqlEndpoint } from '../../api/graphql/endpointHelpers';

export const complianceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    paymentComplianceReview: builder.query<
      ComplianceReview,
      { invoiceId: string; pendingPaymentAmountCents?: number }
    >({
      queryFn: graphqlEndpoint<
        { invoiceId: string; pendingPaymentAmountCents?: number },
        { paymentComplianceReview: ComplianceReview },
        ComplianceReview
      >(
        ({ invoiceId, pendingPaymentAmountCents }) => ({
          document: gqlQuery(
            GRAPHQL_OPERATIONS.QUERIES.PAYMENT_COMPLIANCE_REVIEW,
            `paymentComplianceReview(invoiceId: $invoiceId, pendingPaymentAmountCents: $pendingPaymentAmountCents) {
              available
              summary
              flags { type severity rationale }
            }`,
            '$invoiceId: ID!, $pendingPaymentAmountCents: Int'
          ),
          variables: { invoiceId, pendingPaymentAmountCents },
        }),
        (data) => data.paymentComplianceReview
      ),
    }),
  }),
});

export const {
  usePaymentComplianceReviewQuery,
  useLazyPaymentComplianceReviewQuery,
} = complianceApi;
