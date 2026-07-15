export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNBALANCED_ENTRY'
  | 'OVERPAYMENT'
  | 'INVALID_STATUS'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'GRAPHQL_ERROR';

export interface ApiErrorDetails {
  code: ApiErrorCode;
  message: string;
  status?: number;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly details?: Record<string, unknown>;

  constructor({ code, message, status, details }: ApiErrorDetails) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface GraphQLErrorShape {
  message: string;
  extensions?: {
    code?: string;
    details?: Record<string, unknown>;
  };
}

const SERVER_ERROR_CODES = new Set<ApiErrorCode>([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'UNBALANCED_ENTRY',
  'OVERPAYMENT',
  'INVALID_STATUS',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INTERNAL_ERROR',
]);

function isServerErrorCode(code: string | undefined): code is ApiErrorCode {
  return !!code && SERVER_ERROR_CODES.has(code as ApiErrorCode);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error && typeof error === 'object') {
    const record = error as {
      message?: string;
      code?: string;
      status?: number;
      data?: { message?: string; code?: string; status?: number };
    };

    const code = record.code ?? record.data?.code;
    const message = record.message ?? record.data?.message;
    const status = record.status ?? record.data?.status;

    if (message || code) {
      return new ApiError({
        code: isServerErrorCode(code) ? code : 'GRAPHQL_ERROR',
        message: message ?? 'Request failed',
        status,
      });
    }
  }

  if (error instanceof Error) {
    return new ApiError({
      code: 'GRAPHQL_ERROR',
      message: error.message || 'Request failed',
    });
  }

  return new ApiError({
    code: 'GRAPHQL_ERROR',
    message: 'Request failed',
  });
}

export function parseGraphQLErrors(
  errors: GraphQLErrorShape[],
  status?: number
): ApiError {
  const first = errors[0];
  const code = first?.extensions?.code;
  const message = errors.map((entry) => entry.message).join('; ') || 'Request failed';

  return new ApiError({
    code: isServerErrorCode(code) ? code : 'GRAPHQL_ERROR',
    message,
    status,
    details: first?.extensions?.details,
  });
}

export function parseHttpError(status: number, body?: string): ApiError {
  const message =
    status === 401
      ? 'You are not authorized to perform this action.'
      : status === 403
        ? 'Access to this resource is forbidden.'
        : status === 404
          ? 'The requested resource was not found.'
          : status >= 500
            ? 'The server encountered an error. Please try again later.'
            : `Request failed with status ${status}.`;

  return new ApiError({
    code: 'HTTP_ERROR',
    message: body?.trim() ? body : message,
    status,
  });
}

export function getErrorMessage(error: unknown): string {
  const apiError = toApiError(error);
  return apiError.message || 'Request failed';
}

export function getErrorCode(error: unknown): ApiErrorCode | undefined {
  return toApiError(error).code;
}

export function isNotFoundError(error: unknown): boolean {
  return getErrorCode(error) === 'NOT_FOUND';
}

export function isValidationError(error: unknown): boolean {
  return getErrorCode(error) === 'VALIDATION_ERROR';
}

export function isConflictError(error: unknown): boolean {
  return getErrorCode(error) === 'CONFLICT';
}

export function serializeApiError(error: unknown): {
  message: string;
  code?: ApiErrorCode;
  status?: number;
} {
  const apiError = toApiError(error);
  return {
    message: apiError.message,
    code: apiError.code,
    status: apiError.status,
  };
}
