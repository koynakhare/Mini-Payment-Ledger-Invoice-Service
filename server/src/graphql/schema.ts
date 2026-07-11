import { gql } from 'graphql-tag';

export const typeDefs = gql`
  enum EntryType {
    debit
    credit
  }

  enum AccountType {
    COMPANY_BANK
    VENDOR_PAYABLE
    EXPENSE
  }

  enum InvoiceStatus {
    draft
    sent
    partially_paid
    paid
    overdue
  }

  enum ReversalType {
    refund
    void
  }

  enum Currency {
    USD
    INR
  }

  type Vendor {
    id: ID!
    name: String!
    contactInfo: String
    payableAccount: Account!
    createdAt: String!
  }

  type Account {
    id: ID!
    name: String!
    accountType: AccountType!
    vendorId: ID
    balanceCents: Int!
    createdAt: String!
  }

  type Transaction {
    id: ID!
    description: String!
    referenceType: String
    referenceId: String
    createdAt: String!
    entries: [LedgerEntry!]!
  }

  type LedgerEntry {
    id: ID!
    transactionId: ID!
    accountId: ID!
    amountCents: Int!
    entryType: EntryType!
    currency: Currency!
    createdAt: String!
  }

  type CurrencyLedgerBalance {
    currency: Currency!
    totalDebitsCents: Int!
    totalCreditsCents: Int!
    isBalanced: Boolean!
  }

  type LedgerIntegrityResult {
    isBalanced: Boolean!
    transactionCount: Int!
    entryCount: Int!
    currencyBalances: [CurrencyLedgerBalance!]!
  }

  type AccountStatementLine {
    transactionId: ID!
    description: String!
    entryType: EntryType!
    amountCents: Int!
    runningBalanceCents: Int!
    createdAt: String!
    referenceType: String
    referenceId: String
  }

  type InvoiceLineItem {
    id: ID!
    invoiceId: ID!
    description: String!
    quantity: Int!
    unitPriceCents: Int!
    amountCents: Int!
  }

  type Invoice {
    id: ID!
    vendorId: ID!
    vendor: Vendor!
    vendorAccount: Account!
    invoiceNumber: String!
    currency: Currency!
    status: InvoiceStatus!
    dueDate: String!
    totalCents: Int!
    paidCents: Int!
    remainingCents: Int!
    lineItems: [InvoiceLineItem!]!
    payments: [Payment!]!
    reversals: [Reversal!]!
    createdAt: String!
    updatedAt: String!
  }

  type Payment {
    id: ID!
    invoiceId: ID!
    transactionId: ID!
    amountCents: Int!
    originalAmountCents: Int!
    originalCurrency: Currency!
    exchangeRateUsed: Float
    convertedAmountCents: Int!
    netAmountCents: Int!
    idempotencyKey: String!
    createdAt: String!
    reversals: [Reversal!]!
  }

  type Reversal {
    id: ID!
    paymentId: ID!
    transactionId: ID!
    amountCents: Int!
    reversalType: ReversalType!
    idempotencyKey: String!
    reason: String
    createdAt: String!
  }

  input LedgerEntryInput {
    accountId: ID!
    amountCents: Int!
    entryType: EntryType!
    currency: Currency
  }

  input CreateTransactionInput {
    description: String!
    entries: [LedgerEntryInput!]!
    referenceType: String
    referenceId: String
  }

  input CreateVendorInput {
    name: String!
    contactInfo: String
  }

  input InvoiceLineItemInput {
    description: String!
    quantity: Int!
    unitPriceCents: Int!
  }

  input CreateInvoiceInput {
    vendorId: ID!
    invoiceNumber: String!
    dueDate: String!
    currency: Currency
    lineItems: [InvoiceLineItemInput!]!
  }

  input ApplyPaymentInput {
    invoiceId: ID!
    amountCents: Int!
    currency: Currency
    idempotencyKey: String!
  }

  input ReversePaymentInput {
    paymentId: ID!
    reversalType: ReversalType!
    idempotencyKey: String!
    reason: String
  }

  input CreateAccountInput {
    name: String!
    accountType: AccountType!
  }

  type CreateAccountPayload {
    account: Account
    error: String
  }

  type Query {
    accounts: [Account!]!
    account(id: ID!): Account
    accountStatement(accountId: ID!): [AccountStatementLine!]!
    ledgerIntegrity: LedgerIntegrityResult!
    vendors: [Vendor!]!
    vendor(id: ID!): Vendor
    invoices(status: InvoiceStatus): [Invoice!]!
    invoice(id: ID!): Invoice
    transaction(id: ID!): Transaction
  }

  type Mutation {
    createVendor(input: CreateVendorInput!): Vendor!
    createAccount(input: CreateAccountInput!): CreateAccountPayload!
    recordTransaction(input: CreateTransactionInput!): Transaction!
    createInvoice(input: CreateInvoiceInput!): Invoice!
    sendInvoice(invoiceId: ID!, vendorEmail: String!): Invoice!
    applyPayment(input: ApplyPaymentInput!): Payment!
    reversePayment(input: ReversePaymentInput!): Reversal!
    markOverdueInvoices(asOfDate: String): [Invoice!]!
  }
`;
