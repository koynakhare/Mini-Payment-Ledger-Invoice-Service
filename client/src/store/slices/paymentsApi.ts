import { GRAPHQL_OPERATIONS } from '../../constants/apiEndpoints';
import type { ApplyPaymentInput, Payment, Reversal, ReversePaymentInput } from '../../types';
import { baseApi, invalidationTags } from '../../api/baseApi';
import { gqlMutation, graphqlEndpoint } from '../../api/graphql/endpointHelpers';
import { PAYMENT_FIELDS, REVERSAL_FIELDS } from '../../api/graphql/fragments';

export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    applyPayment: builder.mutation<Payment, ApplyPaymentInput>({
      queryFn: graphqlEndpoint<
        ApplyPaymentInput,
        { applyPayment: Payment },
        Payment
      >(
        (input) => ({
          document: gqlMutation(
            GRAPHQL_OPERATIONS.MUTATIONS.APPLY_PAYMENT,
            `applyPayment(input: $input) { ${PAYMENT_FIELDS} }`,
            '$input: ApplyPaymentInput!'
          ),
          variables: { input },
        }),
        (data) => data.applyPayment
      ),
      invalidatesTags: [...invalidationTags],
    }),

    reversePayment: builder.mutation<Reversal, ReversePaymentInput>({
      queryFn: graphqlEndpoint<
        ReversePaymentInput,
        { reversePayment: Reversal },
        Reversal
      >(
        (input) => ({
          document: gqlMutation(
            GRAPHQL_OPERATIONS.MUTATIONS.REVERSE_PAYMENT,
            `reversePayment(input: $input) { ${REVERSAL_FIELDS} }`,
            '$input: ReversePaymentInput!'
          ),
          variables: { input },
        }),
        (data) => data.reversePayment
      ),
      invalidatesTags: [...invalidationTags],
    }),
  }),
});

export const { useApplyPaymentMutation, useReversePaymentMutation } = paymentsApi;
