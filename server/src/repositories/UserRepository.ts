import { execute, newId, nowIso, queryOne } from '../db/connection.js';
import type { User, UserRole } from '../auth/types.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return row ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await queryOne<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [
      email,
    ]);
    return row ? mapUser(row) : null;
  }

  async findAuthByEmail(
    email: string
  ): Promise<(User & { passwordHash: string }) | null> {
    const row = await queryOne<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [
      email,
    ]);
    if (!row) {
      return null;
    }
    return { ...mapUser(row), passwordHash: row.password_hash };
  }

  async create(email: string, passwordHash: string, role: UserRole): Promise<User> {
    const id = newId();
    const createdAt = nowIso();
    await execute(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, email.trim().toLowerCase(), passwordHash, role, createdAt, createdAt]
    );
    return {
      id,
      email: email.trim().toLowerCase(),
      role,
      createdAt,
      updatedAt: createdAt,
    };
  }
}
