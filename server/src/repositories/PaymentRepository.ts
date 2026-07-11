import sumBy from 'lodash/sumBy.js';
import { newId, nowIso, queryAll, queryOne, execute } from '../db/connection.js';
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
  async findByInvoiceId(invoiceId: string): Promise<Payment[]> {
    const rows = await queryAll<PaymentRow>(
      'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at ASC',
      [invoiceId]
    );
    return rows.map(mapPayment);
  }

  async findById(id: string): Promise<Payment | null> {
    const row = await queryOne<PaymentRow>('SELECT * FROM payments WHERE id = $1', [id]);
    return row ? mapPayment(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    const row = await queryOne<PaymentRow>(
      'SELECT * FROM payments WHERE idempotency_key = $1',
      [key]
    );
    return row ? mapPayment(row) : null;
  }

  async getNetPaidCents(invoiceId: string): Promise<number> {
    const payments = await this.findByInvoiceId(invoiceId);
    const paymentTotal = sumBy(payments, 'convertedAmountCents');

    const reversalTotal = await queryOne<TotalRow>(
      `SELECT COALESCE(SUM(r.amount_cents), 0) AS total
       FROM reversals r
       JOIN payments p ON p.id = r.payment_id
       WHERE p.invoice_id = $1`,
      [invoiceId]
    );

    return paymentTotal - (reversalTotal?.total ?? 0);
  }

  async getNetPaidForPayment(paymentId: string): Promise<number> {
    const payment = await this.findById(paymentId);
    if (!payment) return 0;
    const reversals = await this.findReversalsByPaymentId(paymentId);
    const reversed = sumBy(reversals, 'amountCents');
    return payment.convertedAmountCents - reversed;
  }

  async create(data: CreatePaymentData): Promise<Payment> {
    const id = newId();
    const createdAt = nowIso();
    await execute(
      `INSERT INTO payments (
        id, invoice_id, transaction_id, amount_cents,
        original_amount_cents, original_currency, exchange_rate_used, converted_amount_cents,
        idempotency_key, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        data.invoiceId,
        data.transactionId,
        data.convertedAmountCents,
        data.originalAmountCents,
        data.originalCurrency,
        data.exchangeRateUsed,
        data.convertedAmountCents,
        data.idempotencyKey,
        createdAt,
      ]
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

  async findReversalsByPaymentId(paymentId: string): Promise<Reversal[]> {
    const rows = await queryAll<ReversalRow>(
      'SELECT * FROM reversals WHERE payment_id = $1 ORDER BY created_at ASC',
      [paymentId]
    );
    return rows.map(mapReversal);
  }

  async findReversalsByInvoiceId(invoiceId: string): Promise<Reversal[]> {
    const rows = await queryAll<ReversalRow>(
      `SELECT r.* FROM reversals r
       JOIN payments p ON p.id = r.payment_id
       WHERE p.invoice_id = $1
       ORDER BY r.created_at ASC`,
      [invoiceId]
    );
    return rows.map(mapReversal);
  }

  async findReversalByIdempotencyKey(key: string): Promise<Reversal | null> {
    const row = await queryOne<ReversalRow>(
      'SELECT * FROM reversals WHERE idempotency_key = $1',
      [key]
    );
    return row ? mapReversal(row) : null;
  }

  async createReversal(
    paymentId: string,
    transactionId: string,
    amountCents: number,
    reversalType: ReversalType,
    idempotencyKey: string,
    reason?: string
  ): Promise<Reversal> {
    const id = newId();
    const createdAt = nowIso();
    await execute(
      `INSERT INTO reversals (id, payment_id, transaction_id, amount_cents, reversal_type, idempotency_key, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, paymentId, transactionId, amountCents, reversalType, idempotencyKey, reason ?? null, createdAt]
    );
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
