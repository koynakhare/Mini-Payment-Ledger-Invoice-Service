import { newId, nowIso, queryAll, queryOne, execute } from '../db/connection.js';
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
  async findAll(): Promise<Account[]> {
    const rows = await queryAll<AccountRow>('SELECT * FROM accounts ORDER BY name');
    return rows.map(mapAccount);
  }

  async findById(id: string): Promise<Account | null> {
    const row = await queryOne<AccountRow>('SELECT * FROM accounts WHERE id = $1', [id]);
    return row ? mapAccount(row) : null;
  }

  async findByType(accountType: AccountType): Promise<Account[]> {
    const rows = await queryAll<AccountRow>(
      'SELECT * FROM accounts WHERE account_type = $1 ORDER BY name',
      [accountType]
    );
    return rows.map(mapAccount);
  }

  async findByVendorId(vendorId: string): Promise<Account | null> {
    const row = await queryOne<AccountRow>(
      'SELECT * FROM accounts WHERE vendor_id = $1',
      [vendorId]
    );
    return row ? mapAccount(row) : null;
  }

  async findByNameIgnoreCase(name: string): Promise<Account | null> {
    const row = await queryOne<AccountRow>(
      'SELECT * FROM accounts WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    return row ? mapAccount(row) : null;
  }

  async create(name: string, accountType: AccountType, vendorId?: string | null): Promise<Account> {
    const id = newId();
    const createdAt = nowIso();
    await execute(
      'INSERT INTO accounts (id, name, account_type, vendor_id, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, name, accountType, vendorId ?? null, createdAt]
    );
    return { id, name, accountType, vendorId: vendorId ?? null, createdAt };
  }

  async getBalanceCents(accountId: string): Promise<number> {
    const result = await queryOne<BalanceRow>(
      `SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount_cents ELSE 0 END), 0) AS balance
      FROM ledger_entries
      WHERE account_id = $1`,
      [accountId]
    );
    return result?.balance ?? 0;
  }
}
