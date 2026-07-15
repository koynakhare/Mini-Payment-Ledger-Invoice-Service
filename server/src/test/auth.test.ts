import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { verifyToken } from '../auth/jwt.js';
import {
  authService,
  clearAuthContext,
  createVendorWithInvoice,
  ensureApproverAuth,
  ensureTestUser,
  gql,
  gqlData,
  gqlExpectErrorDetails,
  mutateApplyPayment,
  resetDatabase,
  sendInvoice,
  setAuthContext,
  teardownTestServer,
} from './helpers.js';

describe('auth', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('logs in successfully and returns a token with user role', async () => {
    await authService.createUser('approver@example.com', 'password123', 'APPROVER');

    const data = await gqlData<{
      login: { token: string; user: { email: string; role: string } };
    }>(
      `mutation ($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
          user { email role }
        }
      }`,
      { email: 'approver@example.com', password: 'password123' },
      { user: null }
    );

    assert.equal(data.login.user.email, 'approver@example.com');
    assert.equal(data.login.user.role, 'APPROVER');
    assert.ok(data.login.token.length > 20);

    const payload = verifyToken(data.login.token);
    assert.equal(payload.email, 'approver@example.com');
    assert.equal(payload.role, 'APPROVER');
  });

  it('rejects login with wrong password', async () => {
    await authService.createUser('viewer@example.com', 'password123', 'VIEWER');
    const error = await gqlExpectErrorDetails(
      `mutation ($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
          user { id }
        }
      }`,
      { email: 'viewer@example.com', password: 'wrong-password' },
      { user: null }
    );
    assert.equal(error.code, 'UNAUTHENTICATED');
  });

  it('rejects protected queries without authentication', async () => {
    clearAuthContext();
    const error = await gqlExpectErrorDetails(
      `query { invoices { id } }`,
      undefined,
      { user: null }
    );
    assert.equal(error.code, 'UNAUTHENTICATED');
  });

  it('allows me query for authenticated users', async () => {
    await ensureApproverAuth();
    const data = await gqlData<{ me: { email: string; role: string } }>(`query { me { email role } }`);
    assert.equal(data.me.email, 'approver@test.local');
    assert.equal(data.me.role, 'APPROVER');
  });

  it('rejects VIEWER attempting applyPayment even with a valid token context', async () => {
    const viewer = await ensureTestUser('VIEWER', 'viewer@test.local', 'password123');
    setAuthContext({
      id: viewer.user.id,
      email: viewer.user.email,
      role: viewer.user.role,
    });

    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-AUTH-VIEWER',
      totalCents: 10_000,
    });
    await sendInvoice(invoice.id);

    const error = await gqlExpectErrorDetails(
      `mutation ($input: ApplyPaymentInput!) {
        applyPayment(input: $input) { id }
      }`,
      {
        input: {
          invoiceId: invoice.id,
          amountCents: 10_000,
          idempotencyKey: 'viewer-denied',
        },
      }
    );
    assert.equal(error.code, 'FORBIDDEN');
  });

  it('allows APPROVER to applyPayment', async () => {
    await ensureApproverAuth();
    const { invoice } = await createVendorWithInvoice({
      invoiceNumber: 'INV-AUTH-APPROVER',
      totalCents: 10_000,
    });
    await sendInvoice(invoice.id);

    const result = await mutateApplyPayment({
      invoiceId: invoice.id,
      amountCents: 10_000,
      idempotencyKey: 'approver-ok',
    });
    assert.equal(result.errors, undefined);
    const paymentId = (result.data as { applyPayment?: { id: string } } | undefined)?.applyPayment
      ?.id;
    assert.ok(paymentId);
  });

  it('rejects createInvoice for unauthenticated callers', async () => {
    const error = await gqlExpectErrorDetails(
      `mutation ($input: CreateInvoiceInput!) {
        createInvoice(input: $input) { id }
      }`,
      {
        input: {
          vendorId: 'x',
          invoiceNumber: 'INV-NOAUTH',
          dueDate: '2026-12-31',
          lineItems: [{ description: 'x', quantity: 1, unitPriceCents: 100 }],
        },
      },
      { user: null }
    );
    assert.equal(error.code, 'UNAUTHENTICATED');
  });
});
