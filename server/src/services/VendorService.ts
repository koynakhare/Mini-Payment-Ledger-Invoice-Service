import isEmpty from 'lodash/isEmpty.js';
import trim from 'lodash/trim.js';
import { runInTransaction } from '../db/connection.js';
import { AppError } from '../errors/AppError.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { VendorRepository } from '../repositories/VendorRepository.js';
import type { Account, CreateVendorInput, Vendor } from '../types/index.js';
import { isValidEmail } from '../utils/email.js';

const COMPANY_BANK_NAME = 'Company Bank Account';
const EXPENSE_ACCOUNT_NAME = 'Transportation Expense';

export class VendorService {
  private readonly vendors = new VendorRepository();
  private readonly accounts = new AccountRepository();

  async listVendors(): Promise<Vendor[]> {
    return this.vendors.findAll();
  }

  async getVendor(id: string): Promise<Vendor> {
    const vendor = await this.vendors.findById(id);
    if (!vendor) {
      throw new AppError('NOT_FOUND', `Vendor not found: ${id}`);
    }
    return vendor;
  }

  async getVendorPayableAccount(vendorId: string): Promise<Account> {
    await this.getVendor(vendorId);
    const account = await this.accounts.findByVendorId(vendorId);
    if (!account) {
      throw new AppError('INTERNAL_ERROR', `Vendor payable account missing for vendor: ${vendorId}`);
    }
    return account;
  }

  async createVendor(input: CreateVendorInput): Promise<Vendor> {
    const name = trim(input.name);
    if (isEmpty(name)) {
      throw new AppError('VALIDATION_ERROR', 'Vendor name is required');
    }

    return runInTransaction(async () => {
      const vendor = await this.vendors.create(
        name,
        input.contactInfo ? trim(input.contactInfo) : null
      );
      await this.accounts.create(`Accounts Payable — ${name}`, 'VENDOR_PAYABLE', vendor.id);
      return vendor;
    });
  }

  async ensureVendorPayableAccount(vendorId: string): Promise<Account> {
    const vendor = await this.getVendor(vendorId);
    const existing = await this.accounts.findByVendorId(vendorId);
    if (existing) {
      return existing;
    }
    return this.accounts.create(`Accounts Payable — ${vendor.name}`, 'VENDOR_PAYABLE', vendor.id);
  }

  async updateContactInfo(vendorId: string, contactInfo: string): Promise<Vendor> {
    const email = trim(contactInfo);
    if (isEmpty(email)) {
      throw new AppError('VALIDATION_ERROR', 'Vendor email is required');
    }
    if (!isValidEmail(email)) {
      throw new AppError('VALIDATION_ERROR', 'Enter a valid vendor email address');
    }

    const updated = await this.vendors.updateContactInfo(vendorId, email);
    if (!updated) {
      throw new AppError('NOT_FOUND', `Vendor not found: ${vendorId}`);
    }
    return updated;
  }
}

export class SystemAccountService {
  private readonly accounts = new AccountRepository();

  async ensureCompanyBankAccount(): Promise<Account> {
    const existing = await this.accounts.findByType('COMPANY_BANK');
    if (existing.length > 0) {
      return existing[0];
    }
    return this.accounts.create(COMPANY_BANK_NAME, 'COMPANY_BANK');
  }

  async ensureExpenseAccount(): Promise<Account> {
    const existing = await this.accounts.findByType('EXPENSE');
    if (existing.length > 0) {
      return existing[0];
    }
    return this.accounts.create(EXPENSE_ACCOUNT_NAME, 'EXPENSE');
  }

  async getCompanyBankAccount(): Promise<Account> {
    const accounts = await this.accounts.findByType('COMPANY_BANK');
    if (accounts.length === 0) {
      throw new AppError('INTERNAL_ERROR', 'Company bank account is not configured');
    }
    return accounts[0];
  }

  async getExpenseAccount(): Promise<Account> {
    const accounts = await this.accounts.findByType('EXPENSE');
    if (accounts.length === 0) {
      throw new AppError('INTERNAL_ERROR', 'Expense account is not configured');
    }
    return accounts[0];
  }
}
