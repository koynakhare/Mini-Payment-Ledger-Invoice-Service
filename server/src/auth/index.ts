export type { AuthUser, GraphQLContext, LoginResult, User, UserRole } from './types.js';
export { hashPassword, verifyPassword } from './password.js';
export { extractBearerToken, signToken, verifyToken } from './jwt.js';
export { requireApprover, requireAuth, requireRole } from './guards.js';
export {
  buildGraphQLContext,
  resolveAuthUserFromHeader,
  resolveAuthUserOrThrow,
} from './context.js';
