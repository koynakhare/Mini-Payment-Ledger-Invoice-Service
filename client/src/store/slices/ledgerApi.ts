import { GRAPHQL_OPERATIONS, RTK_TAG_TYPES } from '../../constants/apiEndpoints';
import type { LedgerIntegrityResult } from '../../types';
import { baseApi } from '../../api/baseApi';
import { gqlQuery, graphqlEndpointVoid } from '../../api/graphql/endpointHelpers';
import { LEDGER_INTEGRITY_FIELDS } from '../../api/graphql/fragments';

const ledgerIntegrityQuery = gqlQuery(
  GRAPHQL_OPERATIONS.QUERIES.GET_LEDGER_INTEGRITY,
  `ledgerIntegrity { ${LEDGER_INTEGRITY_FIELDS} }`
);

const verifyLedgerIntegrityQuery = gqlQuery(
  GRAPHQL_OPERATIONS.QUERIES.VERIFY_LEDGER_INTEGRITY,
  `ledgerIntegrity { ${LEDGER_INTEGRITY_FIELDS} }`
);

export const ledgerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLedgerIntegrity: builder.query<LedgerIntegrityResult, void>({
      queryFn: graphqlEndpointVoid<
        { ledgerIntegrity: LedgerIntegrityResult },
        LedgerIntegrityResult
      >(ledgerIntegrityQuery, (data) => data.ledgerIntegrity),
      providesTags: [RTK_TAG_TYPES.LEDGER_INTEGRITY],
    }),

    verifyLedgerIntegrity: builder.mutation<LedgerIntegrityResult, void>({
      queryFn: graphqlEndpointVoid<
        { ledgerIntegrity: LedgerIntegrityResult },
        LedgerIntegrityResult
      >(verifyLedgerIntegrityQuery, (data) => data.ledgerIntegrity),
      invalidatesTags: [RTK_TAG_TYPES.LEDGER_INTEGRITY],
    }),
  }),
});

export const { useGetLedgerIntegrityQuery, useVerifyLedgerIntegrityMutation } = ledgerApi;
