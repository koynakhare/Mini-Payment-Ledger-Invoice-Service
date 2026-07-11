import { GRAPHQL_OPERATIONS, RTK_TAG_TYPES } from '../../constants/apiEndpoints';
import type {
  Account,
  AccountStatementLine,
  CreateAccountInput,
  CreateAccountPayload,
} from '../../types';
import { baseApi } from '../../api/baseApi';
import {
  gqlMutation,
  gqlQuery,
  graphqlEndpoint,
  graphqlEndpointVoid,
} from '../../api/graphql/endpointHelpers';
import { ACCOUNT_FIELDS, ACCOUNT_STATEMENT_FIELDS } from '../../api/graphql/fragments';

export const accountsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAccounts: builder.query<Account[], void>({
      queryFn: graphqlEndpointVoid<{ accounts: Account[] }, Account[]>(
        gqlQuery(GRAPHQL_OPERATIONS.QUERIES.GET_ACCOUNTS, `accounts { ${ACCOUNT_FIELDS} }`),
        (data) => data.accounts
      ),
      providesTags: [RTK_TAG_TYPES.ACCOUNT],
    }),

    createAccount: builder.mutation<CreateAccountPayload, CreateAccountInput>({
      queryFn: graphqlEndpoint<
        CreateAccountInput,
        { createAccount: CreateAccountPayload },
        CreateAccountPayload
      >(
        (input) => ({
          document: gqlMutation(
            GRAPHQL_OPERATIONS.MUTATIONS.CREATE_ACCOUNT,
            `createAccount(input: $input) {
              account { ${ACCOUNT_FIELDS} }
              error
            }`,
            '$input: CreateAccountInput!'
          ),
          variables: { input },
        }),
        (data) => data.createAccount
      ),
      invalidatesTags: [RTK_TAG_TYPES.ACCOUNT],
    }),

    getAccountStatement: builder.query<AccountStatementLine[], string>({
      queryFn: graphqlEndpoint<
        string,
        { accountStatement: AccountStatementLine[] },
        AccountStatementLine[]
      >(
        (accountId) => ({
          document: gqlQuery(
            GRAPHQL_OPERATIONS.QUERIES.GET_ACCOUNT_STATEMENT,
            `accountStatement(accountId: $accountId) { ${ACCOUNT_STATEMENT_FIELDS} }`,
            '$accountId: ID!'
          ),
          variables: { accountId },
        }),
        (data) => data.accountStatement
      ),
      providesTags: (_result, _error, accountId) => [
        { type: RTK_TAG_TYPES.ACCOUNT, id: accountId },
      ],
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useCreateAccountMutation,
  useGetAccountStatementQuery,
} = accountsApi;
