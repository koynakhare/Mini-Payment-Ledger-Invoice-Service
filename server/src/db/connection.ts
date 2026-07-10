import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const defaultPath = path.resolve(process.cwd(), 'data', 'ledger.db');

let db: DatabaseSync | null = null;

export function getDatabasePath(): string {
  return process.env.DATABASE_PATH ?? defaultPath;
}

export function getDb(): DatabaseSync {
  if (!db) {
    const dbPath = getDatabasePath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function runInTransaction<T>(fn: () => T): T {
  const database = getDb();
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
