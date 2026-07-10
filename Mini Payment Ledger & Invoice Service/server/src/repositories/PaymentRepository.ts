import { randomUUID } from 'crypto';
import sumBy from 'lodash/sumBy.js';
import { getDb } from '../db/connection.js';
import { allRows, oneRow } from '../db/sqliteRows.js';
import type { CurrencyCode } from '../config/currencyConfig.js';
import type { Payment, Reversal, ReversalType } from '../types/index.js';

interface PaymentRow {
  id: string;
  invoice_id: string;
  transaction_id: string;
  amount_cents: number;
  original_amount_cents: number | null;
  original_currency: string | null;
  exchange_rate_used: number | null;
  converted_amount_cents: number | null;
  idempotency_key: string;
  created_at: string;
}

interface ReversalRow {
  id: string;
  payment_id: string;
  transaction_id: string;
  amount_cents: number;
  reversal_type: ReversalType;
  idempotency_key: string;
  reason: string | null;
  created_at: string;
}

function mapPayment(row: PaymentRow): Payment {
  const convertedAmountCents = row.converted_amount_cents ?? row.amount_cents;
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    transactionId: row.transaction_id,
    amountCents: convertedAmountCents,
    originalAmountCents: row.original_amount_cents ?? row.amount_cents,
    originalCurrency: (row.original_currency ?? 'USD') as CurrencyCode,
    exchangeRateUsed: row.exchange_rate_used,
    convertedAmountCents,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

function mapReversal(row: ReversalRow): Reversal {
  return {
    id: row.id,
    paymentId: row.payment_id,
    transactionId: row.transaction_id,
    amountCents: row.amount_cents,
    reversalType: row.reversal_type,
    idempotencyKey: row.idempotency_key,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

interface TotalRow {
  total: number;
}

export interface CreatePaymentData {
  invoiceId: string;
  transactionId: string;
  convertedAmountCents: number;
  originalAmountCents: number;
  originalCurrency: CurrencyCode;
  exchangeRateUsed: number | null;
  idempotencyKey: string;
}

export class PaymentRepository {
  findByInvoiceId(invoiceId: string): Payment[] {
    const db = getDb();
    const rows = allRows<PaymentRow>(
      db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at ASC').all(invoiceId)
    );
    return rows.map(mapPayment);
  }

  findById(id: string): Payment | null {
    const db = getDb();
    const row = oneRow<PaymentRow>(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
    return row ? mapPayment(row) : null;
  }

  findByIdempotencyKey(key: string): Payment | null {
    const db = getDb();
    const row = oneRow<PaymentRow>(
      db.prepare('SELECT * FROM payments WHERE idempotency_key = ?').get(key)
    );
    return row ? mapPayment(row) : null;
  }

  getNetPaidCents(invoiceId: string): number {
    const db = getDb();
    const payments = this.findByInvoiceId(invoiceId);
    const paymentTotal = sumBy(payments, 'convertedAmountCents');

    const reversalTotal = oneRow<TotalRow>(db.prepare(`
      SELECT COALESCE(SUM(r.amount_cents), 0) AS total
      FROM reversals r
      JOIN payments p ON p.id = r.payment_id
      WHERE p.invoice_id = ?
    `).get(invoiceId));

    return paymentTotal - (reversalTotal?.total ?? 0);
  }

  getNetPaidForPayment(paymentId: string): number {
    const payment = this.findById(paymentId);
    if (!payment) return 0;
    const reversals = this.findReversalsByPaymentId(paymentId);
    const reversed = sumBy(reversals, 'amountCents');
    return payment.convertedAmountCents - reversed;
  }

  create(data: CreatePaymentData): Payment {
    const db = getDb();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO payments (
        id, invoice_id, transaction_id, amount_cents,
        original_amount_cents, original_currency, exchange_rate_used, converted_amount_cents,
        idempotency_key, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.invoiceId,
      data.transactionId,
      data.convertedAmountCents,
      data.originalAmountCents,
      data.originalCurrency,
      data.exchangeRateUsed,
      data.convertedAmountCents,
      data.idempotencyKey,
      createdAt
    );
    return mapPayment({
      id,
      invoice_id: data.invoiceId,
      transaction_id: data.transactionId,
      amount_cents: data.convertedAmountCents,
      original_amount_cents: data.originalAmountCents,
      original_currency: data.originalCurrency,
      exchange_rate_used: data.exchangeRateUsed,
      converted_amount_cents: data.convertedAmountCents,
      idempotency_key: data.idempotencyKey,
      created_at: createdAt,
    });
  }

  findReversalsByPaymentId(paymentId: string): Reversal[] {
    const db = getDb();
    const rows = allRows<ReversalRow>(
      db.prepare('SELECT * FROM reversals WHERE payment_id = ? ORDER BY created_at ASC').all(paymentId)
    );
    return rows.map(mapReversal);
  }

  findReversalsByInvoiceId(invoiceId: string): Reversal[] {
    const db = getDb();
    const rows = allRows<ReversalRow>(db.prepare(`
      SELECT r.* FROM reversals r
      JOIN payments p ON p.id = r.payment_id
      WHERE p.invoice_id = ?
      ORDER BY r.created_at ASC
    `).all(invoiceId));
    return rows.map(mapReversal);
  }

  findReversalByIdempotencyKey(key: string): Reversal | null {
    const db = getDb();
    const row = oneRow<ReversalRow>(
      db.prepare('SELECT * FROM reversals WHERE idempotency_key = ?').get(key)
    );
    return row ? mapReversal(row) : null;
  }

  createReversal(
    paymentId: string,
    transactionId: string,
    amountCents: number,
    reversalType: ReversalType,
    idempotencyKey: string,
    reason?: string
  ): Reversal {
    const db = getDb();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO reversals (id, payment_id, transaction_id, amount_cents, reversal_type, idempotency_key, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, paymentId, transactionId, amountCents, reversalType, idempotencyKey, reason ?? null, createdAt);
    return {
      id,
      paymentId,
      transactionId,
      amountCents,
      reversalType,
      idempotencyKey,
      reason: reason ?? null,
      createdAt,
    };
  }
}
