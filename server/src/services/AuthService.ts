import { hashPassword, verifyPassword } from '../auth/password.js';
import { signToken } from '../auth/jwt.js';
import type { LoginResult, User, UserRole } from '../auth/types.js';
import { AppError } from '../errors/AppError.js';
import { UserRepository } from '../repositories/UserRepository.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  constructor(private readonly users = new UserRepository()) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new AppError('UNAUTHENTICATED', 'Invalid email or password.');
    }

    const user = await this.users.findAuthByEmail(normalizedEmail);
    if (!user) {
      throw new AppError('UNAUTHENTICATED', 'Invalid email or password.');
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new AppError('UNAUTHENTICATED', 'Invalid email or password.');
    }

    const publicUser: User = {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      token: signToken({ id: user.id, email: user.email, role: user.role }),
      user: publicUser,
    };
  }

  async me(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AppError('UNAUTHENTICATED', 'Authentication required.');
    }
    return user;
  }

  async createUser(email: string, password: string, role: UserRole): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new AppError('VALIDATION_ERROR', 'A valid email address is required.');
    }
    if (password.length < 8) {
      throw new AppError('VALIDATION_ERROR', 'Password must be at least 8 characters.');
    }
    if (role !== 'VIEWER' && role !== 'APPROVER') {
      throw new AppError('VALIDATION_ERROR', 'Role must be VIEWER or APPROVER.');
    }

    const existing = await this.users.findByEmail(normalizedEmail);
    if (existing) {
      throw new AppError('CONFLICT', `A user with email ${normalizedEmail} already exists.`);
    }

    const passwordHash = await hashPassword(password);
    return this.users.create(normalizedEmail, passwordHash, role);
  }
}
