import { randomUUID } from 'crypto';
import { getDb } from '../db/connection.js';
import { allRows, oneRow } from '../db/sqliteRows.js';
import type { Account, AccountType } from '../types/index.js';

interface AccountRow {
  id: string;
  name: string;
  account_type: AccountType;
  vendor_id: string | null;
  created_at: string;
}

interface BalanceRow {
  balance: number;
}

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    accountType: row.account_type,
    vendorId: row.vendor_id,
    createdAt: row.created_at,
  };
}

export class AccountRepository {
  findAll(): Account[] {
    const db = getDb();
    const rows = allRows<AccountRow>(db.prepare('SELECT * FROM accounts ORDER BY name').all());
    return rows.map(mapAccount);
  }

  findById(id: string): Account | null {
    const db = getDb();
    const row = oneRow<AccountRow>(db.prepare('SELECT * FROM accounts WHERE id = ?').get(id));
    return row ? mapAccount(row) : null;
  }

  findByType(accountType: AccountType): Account[] {
    const db = getDb();
    const rows = allRows<AccountRow>(
      db.prepare('SELECT * FROM accounts WHERE account_type = ? ORDER BY name').all(accountType)
    );
    return rows.map(mapAccount);
  }

  findByVendorId(vendorId: string): Account | null {
    const db = getDb();
    const row = oneRow<AccountRow>(
      db.prepare('SELECT * FROM accounts WHERE vendor_id = ?').get(vendorId)
    );
    return row ? mapAccount(row) : null;
  }

  findByNameIgnoreCase(name: string): Account | null {
    const db = getDb();
    const row = oneRow<AccountRow>(
      db.prepare('SELECT * FROM accounts WHERE LOWER(name) = LOWER(?)').get(name)
    );
    return row ? mapAccount(row) : null;
  }

  create(name: string, accountType: AccountType, vendorId?: string | null): Account {
    const db = getDb();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO accounts (id, name, account_type, vendor_id, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, accountType, vendorId ?? null, createdAt);
    return { id, name, accountType, vendorId: vendorId ?? null, createdAt };
  }

  getBalanceCents(accountId: string): number {
    const db = getDb();
    const result = oneRow<BalanceRow>(db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount_cents ELSE 0 END), 0) AS balance
      FROM ledger_entries
      WHERE account_id = ?
    `).get(accountId));
    return result?.balance ?? 0;
  }
}
