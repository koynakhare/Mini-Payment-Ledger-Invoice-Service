import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import { AppError } from '../errors/AppError.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { LedgerRepository } from '../repositories/LedgerRepository.js';
import type {
  Account,
  AccountStatementLine,
  CreateAccountInput,
  CreateTransactionInput,
  LedgerIntegrityResult,
} from '../types/index.js';

export class AccountService {
  private readonly accounts = new AccountRepository();
  private readonly ledger = new LedgerRepository();

  async listAccounts(): Promise<Account[]> {
    return this.accounts.findAll();
  }

  async getAccount(id: string): Promise<Account> {
    const account = await this.accounts.findById(id);
    if (!account) {
      throw new AppError('NOT_FOUND', `Account not found: ${id}`);
    }
    return account;
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    const name = trim(input.name);
    if (isEmpty(name)) {
      throw new AppError('VALIDATION_ERROR', 'Account name is required');
    }

    if (await this.accounts.findByNameIgnoreCase(name)) {
      throw new AppError('CONFLICT', 'An account with this name already exists');
    }

    return this.accounts.create(name, input.accountType);
  }

  async getBalanceCents(accountId: string): Promise<number> {
    await this.getAccount(accountId);
    return this.accounts.getBalanceCents(accountId);
  }

  async getStatement(accountId: string): Promise<AccountStatementLine[]> {
    await this.getAccount(accountId);
    return this.ledger.buildAccountStatement(accountId);
  }

  async recordTransaction(input: CreateTransactionInput) {
    if (isEmpty(trim(input.description))) {
      throw new AppError('VALIDATION_ERROR', 'Transaction description is required');
    }
    if (isEmpty(input.entries) || input.entries.length < 2) {
      throw new AppError('VALIDATION_ERROR', 'Transaction requires at least two entries');
    }

    for (const entry of input.entries) {
      await this.getAccount(entry.accountId);
      if (entry.amountCents <= 0) {
        throw new AppError('VALIDATION_ERROR', 'Entry amounts must be positive integers');
      }
    }

    const normalizedEntries = input.entries.map((entry) => ({
      accountId: entry.accountId,
      amountCents: entry.amountCents,
      entryType: entry.entryType,
      currency: entry.currency ?? 'USD',
    }));

    try {
      LedgerRepository.validateBalancedEntries(normalizedEntries);
    } catch (error) {
      throw new AppError(
        'UNBALANCED_ENTRY',
        error instanceof Error ? error.message : 'Entries are not balanced'
      );
    }

    return this.ledger.createTransaction(
      input.description,
      normalizedEntries,
      input.referenceType,
      input.referenceId
    );
  }

  async verifyLedgerIntegrity(): Promise<LedgerIntegrityResult> {
    return this.ledger.getIntegrityCheck();
  }
}
