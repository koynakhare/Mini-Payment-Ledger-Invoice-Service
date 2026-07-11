import { GRAPHQL_BASE_URL } from '../../constants/apiEndpoints';
import { ApiError, parseGraphQLErrors, parseHttpError } from './errors';

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: { code?: string; details?: Record<string, unknown> };
  }>;
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(GRAPHQL_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server. Check your connection and try again.',
    });
  }

  if (!response.ok) {
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = undefined;
    }
    throw parseHttpError(response.status, body);
  }

  let result: GraphQLResponse<T>;
  try {
    result = (await response.json()) as GraphQLResponse<T>;
  } catch {
    throw new ApiError({
      code: 'GRAPHQL_ERROR',
      message: 'Received an invalid response from the server.',
      status: response.status,
    });
  }

  if (result.errors?.length) {
    throw parseGraphQLErrors(result.errors, response.status);
  }

  if (!result.data) {
    throw new ApiError({
      code: 'GRAPHQL_ERROR',
      message: 'No data returned from the server.',
      status: response.status,
    });
  }

  return result.data;
}
