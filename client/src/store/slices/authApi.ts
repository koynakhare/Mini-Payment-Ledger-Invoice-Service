import { GRAPHQL_OPERATIONS } from '../../constants/apiEndpoints';
import type { AuthPayload } from '../../types';
import { baseApi } from '../../api/baseApi';
import { gqlMutation, gqlQuery, graphqlEndpoint, graphqlEndpointVoid } from '../../api/graphql/endpointHelpers';

const USER_FIELDS = `
  id
  email
  role
  createdAt
  updatedAt
`;

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthPayload, { email: string; password: string }>({
      queryFn: graphqlEndpoint<
        { email: string; password: string },
        { login: AuthPayload },
        AuthPayload
      >(
        ({ email, password }) => ({
          document: gqlMutation(
            GRAPHQL_OPERATIONS.MUTATIONS.LOGIN,
            `login(email: $email, password: $password) {
              token
              user { ${USER_FIELDS} }
            }`,
            '$email: String!, $password: String!'
          ),
          variables: { email, password },
        }),
        (data) => data.login
      ),
    }),

    me: builder.query<AuthPayload['user'], void>({
      queryFn: graphqlEndpointVoid<{ me: AuthPayload['user'] }, AuthPayload['user']>(
        gqlQuery(GRAPHQL_OPERATIONS.QUERIES.ME, `me { ${USER_FIELDS} }`),
        (data) => data.me
      ),
    }),
  }),
});

export const { useLoginMutation, useMeQuery, useLazyMeQuery } = authApi;
