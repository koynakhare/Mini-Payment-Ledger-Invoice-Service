import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'crypto';
import { execute, getDb, isPostgres } from './connection.js';
import { postgresSchemaSql } from './postgresSchema.js';
import { allRows, oneRow } from './sqliteRows.js';

const baseMigrations = `
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_info TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  vendor_id TEXT REFERENCES vendors(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction ON ledger_entries(transaction_id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  invoice_number TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue')),
  due_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  original_amount_cents INTEGER NOT NULL CHECK (original_amount_cents > 0),
  original_currency TEXT NOT NULL,
  exchange_rate_used REAL,
  converted_amount_cents INTEGER NOT NULL CHECK (converted_amount_cents > 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

CREATE TABLE IF NOT EXISTS reversals (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reversal_type TEXT NOT NULL CHECK (reversal_type IN ('refund', 'void')),
  idempotency_key TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reversals_payment ON reversals(payment_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('VIEWER', 'APPROVER')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

interface TableNameRow {
  name: string;
}

interface LegacyAccountRow {
  id: string;
  name: string;
  account_type: string;
  created_at: string;
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = oneRow<TableNameRow>(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
  );
  return row !== undefined;
}

function columnExists(db: DatabaseSync, table: string, column: string): boolean {
  const columns = allRows<TableNameRow>(db.prepare(`PRAGMA table_info(${table})`).all());
  return columns.some((col) => col.name === column);
}

function upgradeLegacyAccounts(db: DatabaseSync): void {
  if (!tableExists(db, 'accounts') || columnExists(db, 'accounts', 'vendor_id')) {
    return;
  }

  db.exec('ALTER TABLE accounts ADD COLUMN vendor_id TEXT REFERENCES vendors(id)');

  const legacyVendorAccounts = allRows<LegacyAccountRow>(
    db.prepare("SELECT * FROM accounts WHERE account_type = 'vendor'").all()
  );

  for (const account of legacyVendorAccounts) {
    const vendorId = randomUUID();
    db.prepare(
      'INSERT INTO vendors (id, name, contact_info, created_at) VALUES (?, ?, NULL, ?)'
    ).run(vendorId, account.name, account.created_at);
    db.prepare(`
      UPDATE accounts
      SET account_type = 'VENDOR_PAYABLE', vendor_id = ?, name = ?
      WHERE id = ?
    `).run(vendorId, `Accounts Payable — ${account.name}`, account.id);
  }

  db.prepare(`
    UPDATE accounts
    SET account_type = 'COMPANY_BANK', name = 'Company Bank Account'
    WHERE account_type = 'cash'
  `).run();

  db.prepare(`
    UPDATE accounts
    SET account_type = 'EXPENSE'
    WHERE account_type = 'expense'
  `).run();

  db.prepare("DELETE FROM accounts WHERE account_type = 'accounts_payable'").run();
}

function upgradeLegacyInvoices(db: DatabaseSync): void {
  if (!tableExists(db, 'invoices')) {
    return;
  }

  if (!columnExists(db, 'invoices', 'vendor_id')) {
    db.exec('ALTER TABLE invoices ADD COLUMN vendor_id TEXT REFERENCES vendors(id)');
  }

  if (columnExists(db, 'invoices', 'vendor_account_id')) {
    db.prepare(`
      UPDATE invoices
      SET vendor_id = (
        SELECT vendor_id FROM accounts WHERE accounts.id = invoices.vendor_account_id
      )
      WHERE vendor_id IS NULL
    `).run();
  }
}

function removeLegacyVendorAccountId(db: DatabaseSync): void {
  if (tableExists(db, 'invoices_migrated')) {
    db.exec('DROP TABLE invoices_migrated');
  }

  if (!tableExists(db, 'invoices') || !columnExists(db, 'invoices', 'vendor_account_id')) {
    return;
  }

  db.exec(`
    CREATE TABLE invoices_migrated (
      id TEXT PRIMARY KEY,
      vendor_id TEXT REFERENCES vendors(id),
      invoice_number TEXT NOT NULL UNIQUE,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue')),
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO invoices_migrated (id, vendor_id, invoice_number, currency, status, due_date, created_at, updated_at)
    SELECT
      id,
      vendor_id,
      invoice_number,
      COALESCE(currency, 'USD'),
      status,
      due_date,
      created_at,
      updated_at
    FROM invoices;

    PRAGMA foreign_keys = OFF;
    DROP TABLE invoices;
    ALTER TABLE invoices_migrated RENAME TO invoices;
    PRAGMA foreign_keys = ON;
  `);
}

function upgradeCurrencyColumns(db: DatabaseSync): void {
  if (tableExists(db, 'invoices') && !columnExists(db, 'invoices', 'currency')) {
    db.exec("ALTER TABLE invoices ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
  }

  if (tableExists(db, 'ledger_entries') && !columnExists(db, 'ledger_entries', 'currency')) {
    db.exec("ALTER TABLE ledger_entries ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
  }

  if (tableExists(db, 'payments')) {
    if (!columnExists(db, 'payments', 'original_amount_cents')) {
      db.exec('ALTER TABLE payments ADD COLUMN original_amount_cents INTEGER');
      db.prepare('UPDATE payments SET original_amount_cents = amount_cents WHERE original_amount_cents IS NULL').run();
    }
    if (!columnExists(db, 'payments', 'original_currency')) {
      db.exec("ALTER TABLE payments ADD COLUMN original_currency TEXT");
      db.prepare("UPDATE payments SET original_currency = 'USD' WHERE original_currency IS NULL").run();
    }
    if (!columnExists(db, 'payments', 'exchange_rate_used')) {
      db.exec('ALTER TABLE payments ADD COLUMN exchange_rate_used REAL');
    }
    if (!columnExists(db, 'payments', 'converted_amount_cents')) {
      db.exec('ALTER TABLE payments ADD COLUMN converted_amount_cents INTEGER');
      db.prepare('UPDATE payments SET converted_amount_cents = amount_cents WHERE converted_amount_cents IS NULL').run();
    }
  }
}

function ensureIndexes(db: DatabaseSync): void {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_vendor_unique ON accounts(vendor_id)
    WHERE vendor_id IS NOT NULL
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_vendor ON accounts(vendor_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');
}

export async function runMigrations(): Promise<void> {
  if (isPostgres()) {
    await execute(postgresSchemaSql);
    return;
  }

  const db = getDb();
  db.exec(baseMigrations);
  upgradeLegacyAccounts(db);
  upgradeLegacyInvoices(db);
  upgradeCurrencyColumns(db);
  removeLegacyVendorAccountId(db);
  ensureIndexes(db);
}
