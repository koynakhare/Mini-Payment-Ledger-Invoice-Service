import { GraphQLError } from 'graphql';
import { requireApprover, requireAuth, type GraphQLContext } from '../auth/index.js';
import { isAppError } from '../errors/AppError.js';
import {
  accountService,
  authService,
  complianceReviewService,
  invoiceExtractionService,
  invoiceService,
  ledgerAssistantService,
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

function wrap<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult | Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (error) {
      return formatError(error);
    }
  };
}

type ResolverFn = (
  parent: unknown,
  args: Record<string, unknown>,
  context: GraphQLContext
) => unknown;

function withAuth(fn: ResolverFn): ResolverFn {
  return wrap((_parent, args, context) => {
    requireAuth(context);
    return fn(_parent, args, context);
  });
}

function withApprover(fn: ResolverFn): ResolverFn {
  return wrap((_parent, args, context) => {
    requireApprover(context);
    return fn(_parent, args, context);
  });
}

export const resolvers = {
  Query: {
    me: wrap((_parent, _args, context: GraphQLContext) => {
      const user = requireAuth(context);
      return authService.me(user.id);
    }),
    accounts: withAuth(() => accountService.listAccounts()),
    account: withAuth((_parent, { id }) => accountService.getAccount(id as string)),
    accountStatement: withAuth((_parent, { accountId }) =>
      accountService.getStatement(accountId as string)
    ),
    ledgerIntegrity: withAuth(() => accountService.verifyLedgerIntegrity()),
    vendors: withAuth(() => vendorService.listVendors()),
    vendor: withAuth((_parent, { id }) => vendorService.getVendor(id as string)),
    invoices: withAuth((_parent, { status }) =>
      invoiceService.listInvoices(
        status as Parameters<typeof invoiceService.listInvoices>[0]
      )
    ),
    invoice: withAuth((_parent, { id }) => invoiceService.getInvoice(id as string)),
    transaction: withAuth(async (_parent, { id }) => {
      const tx = await ledger.findTransactionById(id as string);
      if (!tx) {
        throw new GraphQLError(`Transaction not found: ${id}`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      return tx;
    }),
    paymentComplianceReview: withAuth((_parent, { invoiceId, pendingPaymentAmountCents }) =>
      complianceReviewService.reviewPayment(
        invoiceId as string,
        pendingPaymentAmountCents as number | null | undefined
      )
    ),
    askLedgerAssistant: withAuth((_parent, { question }) =>
      ledgerAssistantService.ask(question as string)
    ),
    extractInvoiceFromDocument: withAuth(
      (_parent, { documentText, documentBase64, mimeType }) =>
        invoiceExtractionService.extractFromDocument({
          documentText: documentText as string | null | undefined,
          documentBase64: documentBase64 as string | null | undefined,
          mimeType: mimeType as string | null | undefined,
        })
    ),
  },

  Mutation: {
    login: wrap((_parent, { email, password }) =>
      authService.login(email as string, password as string)
    ),
    createVendor: withApprover((_parent, { input }) =>
      vendorService.createVendor(input as Parameters<typeof vendorService.createVendor>[0])
    ),
    createAccount: withApprover(async (_parent, { input }) => {
      try {
        const account = await accountService.createAccount(
          input as Parameters<typeof accountService.createAccount>[0]
        );
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
    }),
    recordTransaction: withApprover((_parent, { input }) =>
      accountService.recordTransaction(
        input as Parameters<typeof accountService.recordTransaction>[0]
      )
    ),
    createInvoice: withApprover((_parent, { input }) =>
      invoiceService.createInvoice(input as Parameters<typeof invoiceService.createInvoice>[0])
    ),
    sendInvoice: withApprover((_parent, { invoiceId, vendorEmail }) =>
      invoiceService.sendInvoice(invoiceId as string, vendorEmail as string)
    ),
    applyPayment: withApprover((_parent, { input }) =>
      paymentService.applyPayment(input as Parameters<typeof paymentService.applyPayment>[0])
    ),
    reversePayment: withApprover((_parent, { input }) =>
      paymentService.reversePayment(input as Parameters<typeof paymentService.reversePayment>[0])
    ),
    markOverdueInvoices: withApprover((_parent, { asOfDate }) =>
      invoiceService.markOverdueInvoices(asOfDate as string | undefined)
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
