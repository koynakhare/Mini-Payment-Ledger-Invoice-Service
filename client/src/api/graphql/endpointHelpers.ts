import { graphqlRequest } from './client';
import { runQuery } from './runQuery';

type GqlRequest = {
  document: string;
  variables?: Record<string, unknown>;
};

type GqlRequestBuilder<TArg> = (arg: TArg) => GqlRequest;

export function gqlQuery(
  operationName: string,
  body: string,
  variableDefinitions = ''
): string {
  const vars = variableDefinitions ? `(${variableDefinitions})` : '';
  return `query ${operationName}${vars} { ${body} }`;
}

export function gqlMutation(
  operationName: string,
  body: string,
  variableDefinitions = ''
): string {
  const vars = variableDefinitions ? `(${variableDefinitions})` : '';
  return `mutation ${operationName}${vars} { ${body} }`;
}

export function graphqlEndpoint<TArg, TResponse, TResult>(
  buildRequest: GqlRequestBuilder<TArg>,
  select: (data: TResponse, arg: TArg) => TResult
) {
  return (arg: TArg) =>
    runQuery(async () => {
      const { document, variables } = buildRequest(arg);
      const data = await graphqlRequest<TResponse>(document, variables);
      return select(data, arg);
    });
}

export function graphqlEndpointVoid<TResponse, TResult>(
  document: string,
  select: (data: TResponse) => TResult,
  variables?: Record<string, unknown>
) {
  return () =>
    runQuery(async () => {
      const data = await graphqlRequest<TResponse>(document, variables);
      return select(data);
    });
}
