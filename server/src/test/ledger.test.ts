import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import sumBy from 'lodash/sumBy.js';
import { LedgerRepository } from '../repositories/LedgerRepository.js';
import {
  gqlData,
  gqlExpectError,
  mutateCreateAccount,
  mutateRecordTransaction,
  queryAccountBalance,
  queryLedgerIntegrity,
  queryTransactionEntries,
  ensureApproverAuth,
  resetDatabase,
  sumAllAccountBalances,
  teardownTestServer,
} from './helpers.js';

describe('ledger', () => {
  beforeEach(async () => {
    await resetDatabase();
    await ensureApproverAuth();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('creates a balanced double-entry transaction on two different accounts', async () => {
    const a = await mutateCreateAccount('Operating Cash — Terminal A', 'COMPANY_BANK');
    const b = await mutateCreateAccount('Carrier Payable — Lane 7', 'VENDOR_PAYABLE');
    const accountA = a.createAccount.account!.id;
    const accountB = b.createAccount.account!.id;
    const amount = 47_892;

    const result = await gqlData<{ recordTransaction: { id: string } }>(
      `mutation ($input: CreateTransactionInput!) {
        recordTransaction(input: $input) { id }
      }`,
      {
        input: {
          description: 'Freight settlement',
          entries: [
            { accountId: accountA, amountCents: amount, entryType: 'debit' },
            { accountId: accountB, amountCents: amount, entryType: 'credit' },
          ],
        },
      }
    );

    const tx = await queryTransactionEntries(result.recordTransaction.id);
    const debits = tx.transaction.entries.filter((e) => e.entryType === 'debit');
    const credits = tx.transaction.entries.filter((e) => e.entryType === 'credit');

    assert.equal(debits.length, 1);
    assert.equal(credits.length, 1);
    assert.notEqual(debits[0].accountId, credits[0].accountId);
    assert.equal(debits[0].amountCents, credits[0].amountCents);
    assert.equal(debits[0].amountCents, amount);
  });

  it('derives account balance from the transaction log across multiple postings', async () => {
    const a = await mutateCreateAccount('Balance Probe — Payable', 'VENDOR_PAYABLE');
    const b = await mutateCreateAccount('Balance Probe — Bank', 'COMPANY_BANK');
    const accountId = a.createAccount.account!.id;
    const offsetId = b.createAccount.account!.id;

    const postings = [12_345, 8_900, 15_678];
    let expected = 0;
    for (const amount of postings) {
      await mutateRecordTransaction({
        description: `Accrual ${amount}`,
        entries: [
          { accountId: offsetId, amountCents: amount, entryType: 'debit' },
          { accountId, amountCents: amount, entryType: 'credit' },
        ],
      });
      expected += amount;
    }

    assert.equal(await queryAccountBalance(accountId), expected);
  });

  it('stores monetary amounts as integer cents such that $12.34 equals 1234', async () => {
    const vendor = await gqlData<{ createVendor: { id: string } }>(
      `mutation ($input: CreateVendorInput!) { createVendor(input: $input) { id } }`,
      { input: { name: 'Precision Freight LLC' } }
    );

    const invoice = await gqlData<{ createInvoice: { totalCents: number } }>(
      `mutation ($input: CreateInvoiceInput!) {
        createInvoice(input: $input) { totalCents lineItems { unitPriceCents amountCents } }
      }`,
      {
        input: {
          vendorId: vendor.createVendor.id,
          invoiceNumber: 'INV-CENTS-1234',
          dueDate: '2026-12-01',
          lineItems: [{ description: 'Liftgate', quantity: 1, unitPriceCents: 1234 }],
        },
      }
    );

    assert.equal(invoice.createInvoice.totalCents, 1234);
    assert.equal(Number.isInteger(invoice.createInvoice.totalCents), true);
  });

  it('reports balanced system-wide debits and credits after several transactions', async () => {
    const a = await mutateCreateAccount('Integrity A', 'EXPENSE');
    const b = await mutateCreateAccount('Integrity B', 'COMPANY_BANK');
    const c = await mutateCreateAccount('Integrity C', 'VENDOR_PAYABLE');
    const ids = [
      a.createAccount.account!.id,
      b.createAccount.account!.id,
      c.createAccount.account!.id,
    ];

    await mutateRecordTransaction({
      description: 'Tx 1',
      entries: [
        { accountId: ids[0], amountCents: 25_000, entryType: 'debit' },
        { accountId: ids[1], amountCents: 25_000, entryType: 'credit' },
      ],
    });
    await mutateRecordTransaction({
      description: 'Tx 2',
      entries: [
        { accountId: ids[1], amountCents: 9_875, entryType: 'debit' },
        { accountId: ids[2], amountCents: 9_875, entryType: 'credit' },
      ],
    });
    await mutateRecordTransaction({
      description: 'Tx 3',
      entries: [
        { accountId: ids[2], amountCents: 3_456, entryType: 'debit' },
        { accountId: ids[0], amountCents: 3_456, entryType: 'credit' },
      ],
    });

    const integrity = await queryLedgerIntegrity();
    assert.equal(integrity.ledgerIntegrity.isBalanced, true);
    for (const row of integrity.ledgerIntegrity.currencyBalances) {
      assert.equal(row.totalDebitsCents, row.totalCreditsCents);
      assert.equal(row.isBalanced, true);
    }
    assert.equal(await sumAllAccountBalances(), 0);
  });

  it('rejects an unbalanced transaction', async () => {
    const a = await mutateCreateAccount('Unbalanced A', 'EXPENSE');
    const b = await mutateCreateAccount('Unbalanced B', 'COMPANY_BANK');

    const message = await gqlExpectError(
      `mutation ($input: CreateTransactionInput!) {
        recordTransaction(input: $input) { id }
      }`,
      {
        input: {
          description: 'Broken entry',
          entries: [
            { accountId: a.createAccount.account!.id, amountCents: 10_000, entryType: 'debit' },
            { accountId: b.createAccount.account!.id, amountCents: 9_999, entryType: 'credit' },
          ],
        },
      }
    );

    assert.match(message, /unbalanced|balanced/i);
  });

  it('rejects non-integer cent amounts at the GraphQL API layer', async () => {
    const a = await mutateCreateAccount('Integer Guard A', 'EXPENSE');
    const b = await mutateCreateAccount('Integer Guard B', 'COMPANY_BANK');

    const message = await gqlExpectError(
      `mutation ($input: CreateTransactionInput!) {
        recordTransaction(input: $input) { id }
      }`,
      {
        input: {
          description: 'Fractional cent',
          entries: [
            { accountId: a.createAccount.account!.id, amountCents: 10.5, entryType: 'debit' },
            { accountId: b.createAccount.account!.id, amountCents: 10.5, entryType: 'credit' },
          ],
        },
      }
    );

    assert.match(message, /Int cannot represent|integer/i);
  });

  it('keeps integer cent sums exact across repeated micro-amount postings', async () => {
    const a = await mutateCreateAccount('Micro A', 'EXPENSE');
    const b = await mutateCreateAccount('Micro B', 'COMPANY_BANK');
    const accountId = a.createAccount.account!.id;
    const offsetId = b.createAccount.account!.id;
    const unit = 10 + 20;
    const iterations = 150;

    for (let i = 0; i < iterations; i += 1) {
      await mutateRecordTransaction({
        description: `Micro ${i}`,
        entries: [
          { accountId, amountCents: unit, entryType: 'debit' },
          { accountId: offsetId, amountCents: unit, entryType: 'credit' },
        ],
      });
    }

    assert.equal(await queryAccountBalance(accountId), -(unit * iterations));
    const entries = await new LedgerRepository().findEntriesByAccountId(accountId);
    assert.ok(entries.every((e) => Number.isInteger(e.amountCents)));
    assert.equal(sumBy(entries, 'amountCents'), unit * iterations);
  });
});
