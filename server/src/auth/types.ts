export type UserRole = 'VIEWER' | 'APPROVER';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface GraphQLContext {
  user: AuthUser | null;
}

export interface LoginResult {
  token: string;
  user: User;
}
