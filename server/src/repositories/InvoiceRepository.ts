import sumBy from 'lodash/sumBy.js';
import { isPostgres, newId, nowIso, queryAll, queryOne, execute } from '../db/connection.js';
import type { CurrencyCode } from '../config/currencyConfig.js';
import type { Invoice, InvoiceLineItem, InvoiceStatus } from '../types/index.js';

interface InvoiceRow {
  id: string;
  vendor_id: string;
  invoice_number: string;
  currency: CurrencyCode;
  status: InvoiceStatus;
  due_date: string;
  created_at: string;
  updated_at: string;
}

interface LineItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    invoiceNumber: row.invoice_number,
    currency: row.currency ?? 'USD',
    status: row.status,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLineItem(row: LineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    description: row.description,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    amountCents: row.amount_cents,
  };
}

export interface CreateLineItemData {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export class InvoiceRepository {
  async findAll(status?: InvoiceStatus): Promise<Invoice[]> {
    const rows = status
      ? await queryAll<InvoiceRow>(
          'SELECT * FROM invoices WHERE status = $1 ORDER BY created_at DESC',
          [status]
        )
      : await queryAll<InvoiceRow>('SELECT * FROM invoices ORDER BY created_at DESC');
    return rows.map(mapInvoice);
  }

  async findByVendorId(vendorId: string): Promise<Invoice[]> {
    const rows = await queryAll<InvoiceRow>(
      'SELECT * FROM invoices WHERE vendor_id = $1 ORDER BY created_at DESC',
      [vendorId]
    );
    return rows.map(mapInvoice);
  }

  async findById(id: string): Promise<Invoice | null> {
    const row = await queryOne<InvoiceRow>('SELECT * FROM invoices WHERE id = $1', [id]);
    return row ? mapInvoice(row) : null;
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    const row = await queryOne<InvoiceRow>(
      'SELECT * FROM invoices WHERE lower(invoice_number) = lower($1)',
      [invoiceNumber]
    );
    return row ? mapInvoice(row) : null;
  }

  async findByIdForUpdate(id: string): Promise<Invoice | null> {
    const sql = isPostgres()
      ? 'SELECT * FROM invoices WHERE id = $1 FOR UPDATE'
      : 'SELECT * FROM invoices WHERE id = $1';
    const row = await queryOne<InvoiceRow>(sql, [id]);
    return row ? mapInvoice(row) : null;
  }

  async findLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    const rows = await queryAll<LineItemRow>(
      'SELECT * FROM invoice_line_items WHERE invoice_id = $1',
      [invoiceId]
    );
    return rows.map(mapLineItem);
  }

  async getTotalCents(invoiceId: string): Promise<number> {
    const items = await this.findLineItems(invoiceId);
    return sumBy(items, 'amountCents');
  }

  async create(
    vendorId: string,
    invoiceNumber: string,
    dueDate: string,
    lineItems: CreateLineItemData[],
    currency: CurrencyCode = 'USD'
  ): Promise<Invoice> {
    const id = newId();
    const now = nowIso();

    await execute(
      `INSERT INTO invoices (id, vendor_id, invoice_number, currency, status, due_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7)`,
      [id, vendorId, invoiceNumber, currency, dueDate, now, now]
    );

    for (const item of lineItems) {
      const amountCents = item.quantity * item.unitPriceCents;
      await execute(
        `INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price_cents, amount_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newId(), id, item.description, item.quantity, item.unitPriceCents, amountCents]
      );
    }

    return (await this.findById(id))!;
  }

  async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    const now = nowIso();
    await execute('UPDATE invoices SET status = $1, updated_at = $2 WHERE id = $3', [
      status,
      now,
      id,
    ]);
    return (await this.findById(id))!;
  }

  async findOverdueCandidates(asOfDate: string): Promise<Invoice[]> {
    const rows = await queryAll<InvoiceRow>(
      `SELECT * FROM invoices
       WHERE status IN ('sent', 'partially_paid')
         AND due_date < $1`,
      [asOfDate]
    );
    return rows.map(mapInvoice);
  }
}
