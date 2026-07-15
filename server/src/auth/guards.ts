import { AppError } from '../errors/AppError.js';
import type { AuthUser, GraphQLContext, UserRole } from './types.js';

export function requireAuth(context: GraphQLContext): AuthUser {
  if (!context.user) {
    throw new AppError('UNAUTHENTICATED', 'Authentication required.');
  }
  return context.user;
}

export function requireRole(context: GraphQLContext, ...roles: UserRole[]): AuthUser {
  const user = requireAuth(context);
  if (!roles.includes(user.role)) {
    throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.');
  }
  return user;
}

/** Mutations that change data or financial state require APPROVER. */
export function requireApprover(context: GraphQLContext): AuthUser {
  return requireRole(context, 'APPROVER');
}
