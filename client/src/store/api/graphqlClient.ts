import { GRAPHQL_BASE_URL } from '../../constants/apiEndpoints';

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(GRAPHQL_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors?.length) {
    const message = result.errors.map((e) => e.message).join('; ');
    const error = new Error(message) as Error & { code?: string };
    error.code = result.errors[0]?.extensions?.code;
    throw error;
  }

  if (!result.data) {
    throw new Error('No data returned from GraphQL');
  }

  return result.data;
}
