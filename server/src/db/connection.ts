import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { allRows, oneRow } from './sqliteRows.js';

type SqlParam = string | number | boolean | null;

const defaultSqlitePath = path.resolve(process.cwd(), 'data', 'ledger.db');

const txStorage = new AsyncLocalStorage<DatabaseSync | PoolClient>();

let sqliteDb: DatabaseSync | null = null;
let pgPool: Pool | null = null;
let sqliteTxQueue: Promise<unknown> = Promise.resolve();

export function isPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabasePath(): string {
  return process.env.DATABASE_PATH ?? defaultSqlitePath;
}

export function getDb(): DatabaseSync {
  if (isPostgres()) {
    throw new Error('SQLite is not active when DATABASE_URL is set');
  }

  if (!sqliteDb) {
    const dbPath = getDatabasePath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    sqliteDb = new DatabaseSync(dbPath);
    sqliteDb.exec('PRAGMA journal_mode = WAL');
    sqliteDb.exec('PRAGMA foreign_keys = ON');
  }

  return sqliteDb;
}

export function getPgPool(): Pool {
  if (!isPostgres()) {
    throw new Error('PostgreSQL is not active without DATABASE_URL');
  }

  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL!.trim();
    const useSsl =
      connectionString.includes('supabase.co') ||
      process.env.DATABASE_SSL === 'true';

    pgPool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    });
  }

  return pgPool;
}

function toSqliteSql(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

export function withSqliteQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = sqliteTxQueue.then(() => fn());
  sqliteTxQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function queryAll<T extends QueryResultRow>(
  sql: string,
  params: SqlParam[] = []
): Promise<T[]> {
  if (isPostgres()) {
    const client = txStorage.getStore() as PoolClient | undefined;
    const result = client
      ? await client.query<T>(sql, params)
      : await getPgPool().query<T>(sql, params);
    return result.rows;
  }

  const db = (txStorage.getStore() as DatabaseSync | undefined) ?? getDb();
  return allRows<T>(db.prepare(toSqliteSql(sql)).all(...(params as never[])));
}

export async function queryOne<T extends QueryResultRow>(
  sql: string,
  params: SqlParam[] = []
): Promise<T | undefined> {
  if (isPostgres()) {
    const rows = await queryAll<T>(sql, params);
    return rows[0];
  }

  const db = (txStorage.getStore() as DatabaseSync | undefined) ?? getDb();
  return oneRow<T>(db.prepare(toSqliteSql(sql)).get(...(params as never[])));
}

export async function execute(sql: string, params: SqlParam[] = []): Promise<void> {
  if (isPostgres()) {
    const client = txStorage.getStore() as PoolClient | undefined;
    if (client) {
      await client.query(sql, params);
      return;
    }
    await getPgPool().query(sql, params);
    return;
  }

  const db = (txStorage.getStore() as DatabaseSync | undefined) ?? getDb();
  db.prepare(toSqliteSql(sql)).run(...(params as never[]));
}

export async function runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (isPostgres()) {
    const client = await getPgPool().connect();
    return txStorage.run(client, async () => {
      try {
        await client.query('BEGIN');
        const result = await fn();
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
  }

  const db = getDb();
  return txStorage.run(db, async () => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function closeDb(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }

  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }

  sqliteTxQueue = Promise.resolve();
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
