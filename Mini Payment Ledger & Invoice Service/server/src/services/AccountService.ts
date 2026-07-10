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

  listAccounts(): Account[] {
    return this.accounts.findAll();
  }

  getAccount(id: string): Account {
    const account = this.accounts.findById(id);
    if (!account) {
      throw new AppError('NOT_FOUND', `Account not found: ${id}`);
    }
    return account;
  }

  createAccount(input: CreateAccountInput): Account {
    const name = trim(input.name);
    if (isEmpty(name)) {
      throw new AppError('VALIDATION_ERROR', 'Account name is required');
    }

    if (this.accounts.findByNameIgnoreCase(name)) {
      throw new AppError('CONFLICT', 'An account with this name already exists');
    }

    return this.accounts.create(name, input.accountType);
  }

  getBalanceCents(accountId: string): number {
    this.getAccount(accountId);
    return this.accounts.getBalanceCents(accountId);
  }

  getStatement(accountId: string): AccountStatementLine[] {
    this.getAccount(accountId);
    return this.ledger.buildAccountStatement(accountId);
  }

  recordTransaction(input: CreateTransactionInput) {
    if (isEmpty(trim(input.description))) {
      throw new AppError('VALIDATION_ERROR', 'Transaction description is required');
    }
    if (isEmpty(input.entries) || input.entries.length < 2) {
      throw new AppError('VALIDATION_ERROR', 'Transaction requires at least two entries');
    }

    for (const entry of input.entries) {
      this.getAccount(entry.accountId);
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

  verifyLedgerIntegrity(): LedgerIntegrityResult {
    return this.ledger.getIntegrityCheck();
  }
}
