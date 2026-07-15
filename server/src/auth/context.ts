import type { Request } from 'express';
import { extractBearerToken, verifyToken } from './jwt.js';
import type { AuthUser, GraphQLContext } from './types.js';
import { isAppError } from '../errors/AppError.js';

export function resolveAuthUserFromHeader(
  authorizationHeader: string | undefined
): AuthUser | null {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }
  try {
    return verifyToken(token);
  } catch (error) {
    if (isAppError(error) && error.code === 'UNAUTHENTICATED') {
      return null;
    }
    throw error;
  }
}

export async function buildGraphQLContext({
  req,
}: {
  req: Request;
}): Promise<GraphQLContext> {
  const user = resolveAuthUserFromHeader(req.headers.authorization);
  return { user };
}

/**
 * When a Bearer token is present but invalid/expired, reject with UNAUTHENTICATED
 * instead of treating the request as anonymous.
 */
export function resolveAuthUserOrThrow(
  authorizationHeader: string | undefined
): AuthUser | null {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }
  return verifyToken(token);
}
