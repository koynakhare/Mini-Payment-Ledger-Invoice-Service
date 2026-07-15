import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';
import type { AuthUser, UserRole } from './types.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new AppError(
      'INTERNAL_ERROR',
      'JWT_SECRET is not configured. Set it in the server environment.'
    );
  }
  return secret;
}

function getExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN?.trim() || '8h';
}

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getExpiresIn(),
  } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthUser {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload & JwtPayload;
    if (!decoded.sub || !decoded.email || !decoded.role) {
      throw new AppError('UNAUTHENTICATED', 'Invalid authentication token.');
    }
    if (decoded.role !== 'VIEWER' && decoded.role !== 'APPROVER') {
      throw new AppError('UNAUTHENTICATED', 'Invalid authentication token.');
    }
    return {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('UNAUTHENTICATED', 'Invalid or expired authentication token.');
  }
}

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match?.[1]?.trim() || null;
}
