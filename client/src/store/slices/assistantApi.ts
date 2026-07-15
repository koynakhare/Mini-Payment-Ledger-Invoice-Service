import { GRAPHQL_OPERATIONS } from '../../constants/apiEndpoints';
import type { LedgerAssistantAnswer } from '../../types';
import { baseApi } from '../../api/baseApi';
import { gqlQuery, graphqlEndpoint } from '../../api/graphql/endpointHelpers';

export const assistantApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    askLedgerAssistant: builder.mutation<LedgerAssistantAnswer, string>({
      queryFn: graphqlEndpoint<string, { askLedgerAssistant: LedgerAssistantAnswer }, LedgerAssistantAnswer>(
        (question) => ({
          document: gqlQuery(
            GRAPHQL_OPERATIONS.QUERIES.ASK_LEDGER_ASSISTANT,
            `askLedgerAssistant(question: $question) {
              answered
              operation
              answer
            }`,
            '$question: String!'
          ),
          variables: { question },
        }),
        (data) => data.askLedgerAssistant
      ),
    }),
  }),
});

export const { useAskLedgerAssistantMutation } = assistantApi;
