import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import { runInTransaction } from '../db/connection.js';
import { AppError } from '../errors/AppError.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { VendorRepository } from '../repositories/VendorRepository.js';
import type { Account, CreateVendorInput, Vendor } from '../types/index.js';

const COMPANY_BANK_NAME = 'Company Bank Account';
const EXPENSE_ACCOUNT_NAME = 'Transportation Expense';

export class VendorService {
  private readonly vendors = new VendorRepository();
  private readonly accounts = new AccountRepository();

  listVendors(): Vendor[] {
    return this.vendors.findAll();
  }

  getVendor(id: string): Vendor {
    const vendor = this.vendors.findById(id);
    if (!vendor) {
      throw new AppError('NOT_FOUND', `Vendor not found: ${id}`);
    }
    return vendor;
  }

  getVendorPayableAccount(vendorId: string): Account {
    this.getVendor(vendorId);
    const account = this.accounts.findByVendorId(vendorId);
    if (!account) {
      throw new AppError('INTERNAL_ERROR', `Vendor payable account missing for vendor: ${vendorId}`);
    }
    return account;
  }

  createVendor(input: CreateVendorInput): Vendor {
    const name = trim(input.name);
    if (isEmpty(name)) {
      throw new AppError('VALIDATION_ERROR', 'Vendor name is required');
    }

    return runInTransaction(() => {
      const vendor = this.vendors.create(name, input.contactInfo ? trim(input.contactInfo) : null);
      this.accounts.create(`Accounts Payable — ${name}`, 'VENDOR_PAYABLE', vendor.id);
      return vendor;
    });
  }

  ensureVendorPayableAccount(vendorId: string): Account {
    const vendor = this.getVendor(vendorId);
    const existing = this.accounts.findByVendorId(vendorId);
    if (existing) {
      return existing;
    }
    return this.accounts.create(`Accounts Payable — ${vendor.name}`, 'VENDOR_PAYABLE', vendor.id);
  }
}

export class SystemAccountService {
  private readonly accounts = new AccountRepository();

  ensureCompanyBankAccount(): Account {
    const existing = this.accounts.findByType('COMPANY_BANK');
    if (existing.length > 0) {
      return existing[0];
    }
    return this.accounts.create(COMPANY_BANK_NAME, 'COMPANY_BANK');
  }

  ensureExpenseAccount(): Account {
    const existing = this.accounts.findByType('EXPENSE');
    if (existing.length > 0) {
      return existing[0];
    }
    return this.accounts.create(EXPENSE_ACCOUNT_NAME, 'EXPENSE');
  }

  getCompanyBankAccount(): Account {
    const accounts = this.accounts.findByType('COMPANY_BANK');
    if (accounts.length === 0) {
      throw new AppError('INTERNAL_ERROR', 'Company bank account is not configured');
    }
    return accounts[0];
  }

  getExpenseAccount(): Account {
    const accounts = this.accounts.findByType('EXPENSE');
    if (accounts.length === 0) {
      throw new AppError('INTERNAL_ERROR', 'Expense account is not configured');
    }
    return accounts[0];
  }
}
