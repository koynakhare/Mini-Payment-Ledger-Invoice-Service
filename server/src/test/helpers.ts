import { ApolloServer } from '@apollo/server';
import type { GraphQLContext } from '../auth/types.js';
import { closeDb } from '../db/connection.js';
import { runMigrations } from '../db/migrations.js';
import { resolvers } from '../graphql/resolvers.js';
import { typeDefs } from '../graphql/schema.js';
import { AccountRepository } from '../repositories/AccountRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import {
  accountService,
  authService,
  complianceReviewService,
  invoiceExtractionService,
  invoiceService,
  ledgerAssistantService,
  paymentService,
  systemAccountService,
  vendorService,
} from '../services/index.js';
import type { AuthUser, CurrencyCode, Invoice, UserRole } from '../types/index.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production';

let apolloServer: ApolloServer<GraphQLContext> | null = null;
let defaultAuthContext: GraphQLContext = { user: null };

export async function resetDatabase(): Promise<void> {
  await closeDb();
  delete process.env.DATABASE_URL;
  process.env.DATABASE_PATH = ':memory:';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production';
  // Avoid accidental real SMTP sends during tests when a developer shell exports SMTP_* .
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
  await runMigrations();
  await systemAccountService.ensureCompanyBankAccount();
  await systemAccountService.ensureExpenseAccount();
  defaultAuthContext = { user: null };
}

export async function ensureTestUser(
  role: UserRole = 'APPROVER',
  email = `approver-${role.toLowerCase()}@test.local`,
  password = 'password123'
) {
  const existingLogin = await authService.login(email, password).catch(() => null);
  if (existingLogin) {
    defaultAuthContext = {
      user: {
        id: existingLogin.user.id,
        email: existingLogin.user.email,
        role: existingLogin.user.role,
      },
    };
    return existingLogin;
  }

  try {
    await authService.createUser(email, password, role);
  } catch {
    // may already exist from a concurrent create in the same DB session
  }

  const login = await authService.login(email, password);
  defaultAuthContext = {
    user: {
      id: login.user.id,
      email: login.user.email,
      role: login.user.role,
    },
  };
  return login;
}

export async function ensureApproverAuth(): Promise<void> {
  await ensureTestUser('APPROVER', 'approver@test.local', 'password123');
}

export function setAuthContext(user: AuthUser | null): void {
  defaultAuthContext = { user };
}

export function clearAuthContext(): void {
  defaultAuthContext = { user: null };
}

export async function getTestServer(): Promise<ApolloServer<GraphQLContext>> {
  if (!apolloServer) {
    apolloServer = new ApolloServer({ typeDefs, resolvers });
    await apolloServer.start();
  }
  return apolloServer;
}

export async function teardownTestServer(): Promise<void> {
  if (apolloServer) {
    await apolloServer.stop();
    apolloServer = null;
  }
  await closeDb();
  delete process.env.DATABASE_PATH;
  delete process.env.DATABASE_URL;
}

export interface GqlResult<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

export async function gql<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
  contextValue?: GraphQLContext
): Promise<GqlResult<T>> {
  const server = await getTestServer();
  const response = await server.executeOperation(
    { query, variables },
    { contextValue: contextValue ?? defaultAuthContext }
  );
  if (response.body.kind !== 'single') {
    throw new Error('Unexpected incremental GraphQL response');
  }
  return response.body.singleResult as GqlResult<T>;
}

export async function gqlData<T>(
  query: string,
  variables?: Record<string, unknown>,
  contextValue?: GraphQLContext
): Promise<T> {
  const result = await gql<T>(query, variables, contextValue);
  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }
  return result.data as T;
}

export async function gqlExpectError(
  query: string,
  variables?: Record<string, unknown>,
  contextValue?: GraphQLContext
): Promise<string> {
  const result = await gqlExpectErrorDetails(query, variables, contextValue);
  return result.message;
}

export async function gqlExpectErrorDetails(
  query: string,
  variables?: Record<string, unknown>,
  contextValue?: GraphQLContext
): Promise<{ message: string; code?: string }> {
  const result = await gql(query, variables, contextValue);
  if (!result.errors?.length) {
    throw new Error('Expected GraphQL error but request succeeded');
  }
  return {
    message: result.errors[0].message,
    code: result.errors[0].extensions?.code,
  };
}

const ACCOUNT_FIELDS = `
  id
  name
  accountType
  balanceCents
`;

const INVOICE_FIELDS = `
  id
  invoiceNumber
  status
  currency
  totalCents
  paidCents
  remainingCents
`;

export async function queryAccountBalance(accountId: string): Promise<number> {
  const data = await gqlData<{ account: { balanceCents: number } }>(
    `query ($id: ID!) { account(id: $id) { balanceCents } }`,
    { id: accountId }
  );
  return data.account.balanceCents;
}

export async function mutateCreateAccount(name: string, accountType: string) {
  return gqlData<{
    createAccount: {
      account: { id: string; name: string; balanceCents: number } | null;
      error: string | null;
    };
  }>(
    `mutation ($input: CreateAccountInput!) {
      createAccount(input: $input) {
        account { ${ACCOUNT_FIELDS} }
        error
      }
    }`,
    { input: { name, accountType } }
  );
}

export async function mutateRecordTransaction(input: {
  description: string;
  entries: Array<{
    accountId: string;
    amountCents: number;
    entryType: string;
    currency?: string;
  }>;
}) {
  return gql(
    `mutation ($input: CreateTransactionInput!) {
      recordTransaction(input: $input) { id }
    }`,
    { input }
  );
}

export async function mutateCreateVendor(name: string) {
  return gqlData<{ createVendor: { id: string; name: string } }>(
    `mutation ($input: CreateVendorInput!) {
      createVendor(input: $input) { id name }
    }`,
    { input: { name } }
  );
}

export async function mutateCreateInvoice(input: {
  vendorId: string;
  invoiceNumber: string;
  dueDate: string;
  currency?: CurrencyCode;
  lineItems: Array<{ description: string; quantity: number; unitPriceCents: number }>;
}) {
  return gqlData<{
    createInvoice: Invoice & {
      totalCents: number;
      paidCents: number;
      remainingCents: number;
    };
  }>(
    `mutation ($input: CreateInvoiceInput!) {
      createInvoice(input: $input) { ${INVOICE_FIELDS} }
    }`,
    { input }
  );
}

export async function mutateSendInvoice(invoiceId: string, vendorEmail = 'vendor@test.com') {
  return gqlData<{ sendInvoice: { id: string; status: string } }>(
    `mutation ($invoiceId: ID!, $vendorEmail: String!) {
      sendInvoice(invoiceId: $invoiceId, vendorEmail: $vendorEmail) { id status }
    }`,
    { invoiceId, vendorEmail }
  );
}

export async function mutateApplyPayment(input: {
  invoiceId: string;
  amountCents: number;
  currency?: CurrencyCode;
  idempotencyKey: string;
}) {
  return gql(
    `mutation ($input: ApplyPaymentInput!) {
      applyPayment(input: $input) {
        id
        convertedAmountCents
        originalAmountCents
        originalCurrency
        netAmountCents
      }
    }`,
    { input }
  );
}

export async function mutateReversePayment(input: {
  paymentId: string;
  reversalType: string;
  idempotencyKey: string;
  reason?: string;
}) {
  return gql(
    `mutation ($input: ReversePaymentInput!) {
      reversePayment(input: $input) { id amountCents reversalType }
    }`,
    { input }
  );
}

export async function mutateMarkOverdue(asOfDate: string) {
  return gqlData<{ markOverdueInvoices: Array<{ id: string; status: string }> }>(
    `mutation ($asOfDate: String) {
      markOverdueInvoices(asOfDate: $asOfDate) { id status }
    }`,
    { asOfDate }
  );
}

export async function queryInvoice(invoiceId: string) {
  const data = await gqlData<{
    invoice: {
      status: string;
      totalCents: number;
      paidCents: number;
      remainingCents: number;
    };
  }>(
    `query ($id: ID!) {
      invoice(id: $id) { status totalCents paidCents remainingCents }
    }`,
    { id: invoiceId }
  );
  return data.invoice;
}

export async function sumAllAccountBalances(): Promise<number> {
  const accountsRepo = new AccountRepository();
  const all = await accountsRepo.findAll();
  let total = 0;
  for (const account of all) {
    total += await accountsRepo.getBalanceCents(account.id);
  }
  return total;
}

export async function countPaymentsForInvoice(invoiceId: string): Promise<number> {
  const payments = await new PaymentRepository().findByInvoiceId(invoiceId);
  return payments.length;
}

export async function countPaymentTransactionsForInvoice(invoiceId: string): Promise<number> {
  const payments = await new PaymentRepository().findByInvoiceId(invoiceId);
  return payments.length;
}

export async function queryLedgerIntegrity() {
  return gqlData<{
    ledgerIntegrity: {
      isBalanced: boolean;
      currencyBalances: Array<{
        currency: string;
        totalDebitsCents: number;
        totalCreditsCents: number;
        isBalanced: boolean;
      }>;
    };
  }>(`query {
    ledgerIntegrity {
      isBalanced
      currencyBalances { currency totalDebitsCents totalCreditsCents isBalanced }
    }
  }`);
}

export async function queryTransactionEntries(transactionId: string) {
  return gqlData<{
    transaction: {
      entries: Array<{ accountId: string; amountCents: number; entryType: string }>;
    };
  }>(
    `query ($id: ID!) {
      transaction(id: $id) {
        entries { accountId amountCents entryType }
      }
    }`,
    { id: transactionId }
  );
}

export async function createVendorWithInvoice(options?: {
  invoiceNumber?: string;
  dueDate?: string;
  totalCents?: number;
  currency?: CurrencyCode;
  description?: string;
}) {
  const vendor = await vendorService.createVendor({ name: 'Acme Freight Co.' });
  const totalCents = options?.totalCents ?? 427_583;
  const invoice = await invoiceService.createInvoice({
    vendorId: vendor.id,
    invoiceNumber: options?.invoiceNumber ?? `INV-${Date.now()}`,
    dueDate: options?.dueDate ?? '2026-12-31',
    currency: options?.currency,
    lineItems: [
      {
        description: options?.description ?? 'Linehaul freight Chicago to Dallas',
        quantity: 1,
        unitPriceCents: totalCents,
      },
    ],
  });
  return { vendor, invoice };
}

export async function sendInvoice(invoiceId: string, vendorEmail = 'vendor@test.com') {
  return invoiceService.sendInvoice(invoiceId, vendorEmail);
}

export {
  accountService,
  authService,
  complianceReviewService,
  invoiceExtractionService,
  invoiceService,
  ledgerAssistantService,
  paymentService,
  vendorService,
};
