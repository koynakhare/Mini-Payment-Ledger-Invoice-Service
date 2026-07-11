import { GraphQLError } from 'graphql';
import { isAppError } from '../errors/AppError.js';
import {
  accountService,
  invoiceService,
  paymentService,
  vendorService,
} from '../services/index.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { LedgerRepository } from '../repositories/LedgerRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';

const accounts = new AccountRepository();
const ledger = new LedgerRepository();
const payments = new PaymentRepository();

function formatError(error: unknown): never {
  if (isAppError(error)) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, details: error.details },
    });
  }
  if (error instanceof GraphQLError) {
    throw error;
  }
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  throw new GraphQLError(message, { extensions: { code: 'INTERNAL_ERROR' } });
}

function wrap<T extends (...args: never[]) => unknown>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      return formatError(error);
    }
  }) as T;
}

export const resolvers = {
  Query: {
    accounts: wrap(() => accountService.listAccounts()),
    account: wrap((_: unknown, { id }: { id: string }) => accountService.getAccount(id)),
    accountStatement: wrap((_: unknown, { accountId }: { accountId: string }) =>
      accountService.getStatement(accountId)
    ),
    ledgerIntegrity: wrap(() => accountService.verifyLedgerIntegrity()),
    vendors: wrap(() => vendorService.listVendors()),
    vendor: wrap((_: unknown, { id }: { id: string }) => vendorService.getVendor(id)),
    invoices: wrap((_: unknown, { status }: { status?: string }) =>
      invoiceService.listInvoices(status as Parameters<typeof invoiceService.listInvoices>[0])
    ),
    invoice: wrap((_: unknown, { id }: { id: string }) => invoiceService.getInvoice(id)),
    transaction: wrap(async (_: unknown, { id }: { id: string }) => {
      const tx = await ledger.findTransactionById(id);
      if (!tx) {
        throw new GraphQLError(`Transaction not found: ${id}`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      return tx;
    }),
  },

  Mutation: {
    createVendor: wrap(
      (_: unknown, { input }: { input: Parameters<typeof vendorService.createVendor>[0] }) =>
        vendorService.createVendor(input)
    ),
    createAccount: wrap(
      async (_: unknown, { input }: { input: Parameters<typeof accountService.createAccount>[0] }) => {
        try {
          const account = await accountService.createAccount(input);
          return { account, error: null };
        } catch (error) {
          if (
            isAppError(error) &&
            (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT')
          ) {
            return { account: null, error: error.message };
          }
          return formatError(error);
        }
      }
    ),
    recordTransaction: wrap(
      (_: unknown, { input }: { input: Parameters<typeof accountService.recordTransaction>[0] }) =>
        accountService.recordTransaction(input)
    ),
    createInvoice: wrap(
      (_: unknown, { input }: { input: Parameters<typeof invoiceService.createInvoice>[0] }) =>
        invoiceService.createInvoice(input)
    ),
    sendInvoice: wrap(
      (_: unknown, { invoiceId, vendorEmail }: { invoiceId: string; vendorEmail: string }) =>
        invoiceService.sendInvoice(invoiceId, vendorEmail)
    ),
    applyPayment: wrap(
      (_: unknown, { input }: { input: Parameters<typeof paymentService.applyPayment>[0] }) =>
        paymentService.applyPayment(input)
    ),
    reversePayment: wrap(
      (_: unknown, { input }: { input: Parameters<typeof paymentService.reversePayment>[0] }) =>
        paymentService.reversePayment(input)
    ),
    markOverdueInvoices: wrap((_: unknown, { asOfDate }: { asOfDate?: string }) =>
      invoiceService.markOverdueInvoices(asOfDate)
    ),
  },

  Vendor: {
    payableAccount: (parent: { id: string }) => vendorService.getVendorPayableAccount(parent.id),
  },

  Account: {
    balanceCents: (parent: { id: string }) => accounts.getBalanceCents(parent.id),
  },

  Transaction: {
    entries: (parent: { id: string }) => ledger.findEntriesByTransactionId(parent.id),
  },

  Invoice: {
    vendor: (parent: { vendorId: string }) => vendorService.getVendor(parent.vendorId),
    vendorAccount: (parent: { vendorId: string }) =>
      vendorService.getVendorPayableAccount(parent.vendorId),
    totalCents: (parent: { id: string }) => invoiceService.getInvoiceTotalCents(parent.id),
    paidCents: (parent: { id: string }) => payments.getNetPaidCents(parent.id),
    remainingCents: (parent: { id: string }) => invoiceService.getRemainingBalanceCents(parent.id),
    lineItems: (parent: { id: string }) => invoiceService.getLineItems(parent.id),
    payments: (parent: { id: string }) => paymentService.getPaymentsForInvoice(parent.id),
    reversals: (parent: { id: string }) => paymentService.getReversalsForInvoice(parent.id),
  },

  Payment: {
    amountCents: (parent: { convertedAmountCents: number }) => parent.convertedAmountCents,
    netAmountCents: (parent: { id: string }) => payments.getNetPaidForPayment(parent.id),
    reversals: (parent: { id: string }) => payments.findReversalsByPaymentId(parent.id),
  },
};
