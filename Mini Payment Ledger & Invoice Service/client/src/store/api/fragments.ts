export const ACCOUNT_FIELDS = `
  id
  name
  accountType
  vendorId
  balanceCents
  createdAt
`;

export const VENDOR_FIELDS = `
  id
  name
  contactInfo
  createdAt
  payableAccount { ${ACCOUNT_FIELDS} }
`;

export const INVOICE_FIELDS = `
  id
  vendorId
  vendor { ${VENDOR_FIELDS} }
  vendorAccount { ${ACCOUNT_FIELDS} }
  invoiceNumber
  currency
  status
  dueDate
  totalCents
  paidCents
  remainingCents
  lineItems {
    id
    description
    quantity
    unitPriceCents
    amountCents
  }
  payments {
    id
    amountCents
    originalAmountCents
    originalCurrency
    exchangeRateUsed
    convertedAmountCents
    netAmountCents
    idempotencyKey
    transactionId
    createdAt
    reversals {
      id
      amountCents
      reversalType
      reason
      createdAt
    }
  }
  reversals {
    id
    paymentId
    amountCents
    reversalType
    reason
    createdAt
  }
  createdAt
  updatedAt
`;
