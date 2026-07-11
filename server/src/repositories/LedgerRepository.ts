import sumBy from 'lodash/sumBy.js';
import { newId, nowIso, queryAll, queryOne, execute, runInTransaction } from '../db/connection.js';
import type {
  AccountStatementLine,
  CurrencyCode,
  CurrencyLedgerBalance,
  EntryType,
  LedgerEntry,
  LedgerIntegrityResult,
  Transaction,
} from '../types/index.js';
import { CURRENCY_CONFIG } from '../config/currencyConfig.js';

interface TransactionRow {
  id: string;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

interface LedgerEntryRow {
  id: string;
  transaction_id: string;
  account_id: string;
  amount_cents: number;
  entry_type: EntryType;
  currency: CurrencyCode;
  created_at: string;
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    description: row.description,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    createdAt: row.created_at,
  };
}

function mapEntry(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    accountId: row.account_id,
    amountCents: row.amount_cents,
    entryType: row.entry_type,
    currency: row.currency ?? 'USD',
    createdAt: row.created_at,
  };
}

interface LedgerEntryWithTransactionRow extends LedgerEntryRow {
  description: string;
  reference_type: string | null;
  reference_id: string | null;
}

interface CurrencyIntegrityRow {
  currency: CurrencyCode;
  total_debits: number;
  total_credits: number;
  entry_count: number;
}

interface CountRow {
  count: number;
}

export interface CreateLedgerEntryInput {
  accountId: string;
  amountCents: number;
  entryType: EntryType;
  currency: CurrencyCode;
}

export class LedgerRepository {
  async findTransactionById(id: string): Promise<Transaction | null> {
    const row = await queryOne<TransactionRow>('SELECT * FROM transactions WHERE id = $1', [id]);
    return row ? mapTransaction(row) : null;
  }

  async findEntriesByTransactionId(transactionId: string): Promise<LedgerEntry[]> {
    const rows = await queryAll<LedgerEntryRow>(
      'SELECT * FROM ledger_entries WHERE transaction_id = $1 ORDER BY entry_type',
      [transactionId]
    );
    return rows.map(mapEntry);
  }

  async findEntriesByAccountId(
    accountId: string
  ): Promise<Array<LedgerEntry & { description: string; referenceType: string | null; referenceId: string | null }>> {
    const rows = await queryAll<LedgerEntryWithTransactionRow>(
      `SELECT le.*, t.description, t.reference_type, t.reference_id
       FROM ledger_entries le
       JOIN transactions t ON t.id = le.transaction_id
       WHERE le.account_id = $1
       ORDER BY le.created_at ASC, le.id ASC`,
      [accountId]
    );

    return rows.map((row) => ({
      ...mapEntry(row),
      description: row.description,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
    }));
  }

  async createTransaction(
    description: string,
    entries: CreateLedgerEntryInput[],
    referenceType?: string,
    referenceId?: string
  ): Promise<Transaction> {
    return runInTransaction(() =>
      this.insertTransaction(description, entries, referenceType, referenceId)
    );
  }

  async insertTransaction(
    description: string,
    entries: CreateLedgerEntryInput[],
    referenceType?: string,
    referenceId?: string
  ): Promise<Transaction> {
    const transactionId = newId();
    const createdAt = nowIso();

    await execute(
      `INSERT INTO transactions (id, description, reference_type, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [transactionId, description, referenceType ?? null, referenceId ?? null, createdAt]
    );

    for (const entry of entries) {
      await execute(
        `INSERT INTO ledger_entries (id, transaction_id, account_id, amount_cents, entry_type, currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newId(),
          transactionId,
          entry.accountId,
          entry.amountCents,
          entry.entryType,
          entry.currency,
          createdAt,
        ]
      );
    }

    return {
      id: transactionId,
      description,
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
      createdAt,
    };
  }

  async getIntegrityCheck(): Promise<LedgerIntegrityResult> {
    const currencyRows = await queryAll<CurrencyIntegrityRow>(`
      SELECT
        currency,
        COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount_cents ELSE 0 END), 0) AS total_debits,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE 0 END), 0) AS total_credits,
        COUNT(*) AS entry_count
      FROM ledger_entries
      GROUP BY currency
    `);

    const txCount = await queryOne<CountRow>('SELECT COUNT(*) AS count FROM transactions');

    const existingCurrencies = new Set(currencyRows.map((row) => row.currency));
    const currencyBalances: CurrencyLedgerBalance[] = CURRENCY_CONFIG.SUPPORTED_CURRENCIES.filter(
      (currency) => existingCurrencies.has(currency)
    ).map((currency) => {
      const row = currencyRows.find((item) => item.currency === currency)!;
      return {
        currency,
        totalDebitsCents: row.total_debits,
        totalCreditsCents: row.total_credits,
        isBalanced: row.total_debits === row.total_credits,
      };
    });

    const entryCount = currencyRows.reduce((sum, row) => sum + row.entry_count, 0);

    return {
      isBalanced: currencyBalances.every((balance) => balance.isBalanced),
      transactionCount: txCount?.count ?? 0,
      entryCount,
      currencyBalances,
    };
  }

  async buildAccountStatement(accountId: string): Promise<AccountStatementLine[]> {
    const entries = await this.findEntriesByAccountId(accountId);
    let runningBalance = 0;

    return entries.map((entry) => {
      const delta = entry.entryType === 'credit' ? entry.amountCents : -entry.amountCents;
      runningBalance += delta;
      return {
        transactionId: entry.transactionId,
        description: entry.description,
        entryType: entry.entryType,
        amountCents: entry.amountCents,
        runningBalanceCents: runningBalance,
        createdAt: entry.createdAt,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
      };
    });
  }

  static validateBalancedEntries(entries: CreateLedgerEntryInput[]): void {
    const currencies = new Set(entries.map((entry) => entry.currency));
    if (currencies.size !== 1) {
      throw new Error('All entries in a transaction must use the same currency');
    }

    const totalDebits = sumBy(
      entries.filter((e) => e.entryType === 'debit'),
      'amountCents'
    );
    const totalCredits = sumBy(
      entries.filter((e) => e.entryType === 'credit'),
      'amountCents'
    );
    if (totalDebits !== totalCredits) {
      throw new Error(`Unbalanced entries: debits=${totalDebits}, credits=${totalCredits}`);
    }
    if (totalDebits === 0) {
      throw new Error('Transaction must have non-zero entries');
    }
  }
}
