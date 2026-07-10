import { randomUUID } from 'crypto';
import sumBy from 'lodash/sumBy.js';
import { getDb } from '../db/connection.js';
import { allRows, oneRow } from '../db/sqliteRows.js';
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
  findAll(status?: InvoiceStatus): Invoice[] {
    const db = getDb();
    let rows: InvoiceRow[];
    if (status) {
      rows = allRows<InvoiceRow>(
        db.prepare('SELECT * FROM invoices WHERE status = ? ORDER BY created_at DESC').all(status)
      );
    } else {
      rows = allRows<InvoiceRow>(db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all());
    }
    return rows.map(mapInvoice);
  }

  findById(id: string): Invoice | null {
    const db = getDb();
    const row = oneRow<InvoiceRow>(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id));
    return row ? mapInvoice(row) : null;
  }

  findByIdForUpdate(id: string): Invoice | null {
    return this.findById(id);
  }

  findLineItems(invoiceId: string): InvoiceLineItem[] {
    const db = getDb();
    const rows = allRows<LineItemRow>(
      db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ?').all(invoiceId)
    );
    return rows.map(mapLineItem);
  }

  getTotalCents(invoiceId: string): number {
    const items = this.findLineItems(invoiceId);
    return sumBy(items, 'amountCents');
  }

  create(
    vendorId: string,
    invoiceNumber: string,
    dueDate: string,
    lineItems: CreateLineItemData[],
    currency: CurrencyCode = 'USD'
  ): Invoice {
    const id = randomUUID();
    const now = new Date().toISOString();

    const db = getDb();
    db.prepare(`
      INSERT INTO invoices (id, vendor_id, invoice_number, currency, status, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)
    `).run(id, vendorId, invoiceNumber, currency, dueDate, now, now);

    const insertLineItem = db.prepare(`
      INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price_cents, amount_cents)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of lineItems) {
      const amountCents = item.quantity * item.unitPriceCents;
      insertLineItem.run(
        randomUUID(),
        id,
        item.description,
        item.quantity,
        item.unitPriceCents,
        amountCents
      );
    }

    return this.findById(id)!;
  }

  updateStatus(id: string, status: InvoiceStatus): Invoice {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    return this.findById(id)!;
  }

  findOverdueCandidates(asOfDate: string): Invoice[] {
    const db = getDb();
    const rows = allRows<InvoiceRow>(db.prepare(`
      SELECT * FROM invoices
      WHERE status IN ('sent', 'partially_paid')
        AND due_date < ?
    `).all(asOfDate));
    return rows.map(mapInvoice);
  }
}
