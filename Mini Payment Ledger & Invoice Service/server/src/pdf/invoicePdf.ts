import type { Invoice, InvoiceLineItem } from '../types/index.js';
import type { CurrencyCode } from '../types/index.js';

export interface InvoicePdfData {
  invoice: Invoice;
  vendorName: string;
  vendorContact: string | null;
  lineItems: InvoiceLineItem[];
  totalCents: number;
  paidCents: number;
  remainingCents: number;
}

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  INR: '₹',
};

function formatCents(cents: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const amount = Math.abs(cents) / 100;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}

export function invoicePdfFilename(invoiceNumber: string): string {
  return `invoice-${sanitizeFilename(invoiceNumber)}.pdf`;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rightEdge = doc.page.margins.left + pageWidth;

    doc
      .fillColor('#0F2B4A')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('INVOICE', doc.page.margins.left, 50);

    doc
      .fillColor('#4A5D73')
      .fontSize(10)
      .font('Helvetica')
      .text('TMS Accounts Payable', doc.page.margins.left, 78);

    doc
      .fillColor('#0A1628')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(data.invoice.invoiceNumber, rightEdge - 150, 50, { width: 150, align: 'right' });

    doc
      .fillColor('#4A5D73')
      .font('Helvetica')
      .text(`Status: ${formatStatus(data.invoice.status)}`, rightEdge - 150, 66, {
        width: 150,
        align: 'right',
      });

    doc
      .fillColor('#4A5D73')
      .font('Helvetica')
      .text(`Currency: ${data.invoice.currency}`, rightEdge - 150, 82, {
        width: 150,
        align: 'right',
      });

    doc
      .moveTo(doc.page.margins.left, 105)
      .lineTo(rightEdge, 105)
      .strokeColor('#D8E2ED')
      .stroke();

    const billTop = 125;

    doc.fillColor('#8B9CB0').fontSize(9).font('Helvetica-Bold').text('BILL TO', doc.page.margins.left, billTop);

    doc
      .fillColor('#0A1628')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(data.vendorName, doc.page.margins.left, billTop + 16);

    if (data.vendorContact) {
      doc
        .fillColor('#4A5D73')
        .fontSize(10)
        .font('Helvetica')
        .text(data.vendorContact, doc.page.margins.left, billTop + 34);
    }

    const metaTop = billTop;
    const metaX = rightEdge - 180;

    doc.fillColor('#8B9CB0').fontSize(9).font('Helvetica-Bold').text('INVOICE DATE', metaX, metaTop, {
      width: 180,
      align: 'right',
    });
    doc
      .fillColor('#0A1628')
      .fontSize(10)
      .font('Helvetica')
      .text(formatDate(data.invoice.createdAt), metaX, metaTop + 14, { width: 180, align: 'right' });

    doc.fillColor('#8B9CB0').fontSize(9).font('Helvetica-Bold').text('DUE DATE', metaX, metaTop + 36, {
      width: 180,
      align: 'right',
    });
    doc
      .fillColor('#0A1628')
      .fontSize(10)
      .font('Helvetica')
      .text(formatDate(data.invoice.dueDate), metaX, metaTop + 50, { width: 180, align: 'right' });

    const tableTop = 210;
    const colDesc = doc.page.margins.left;
    const colQty = colDesc + pageWidth * 0.55;
    const colUnit = colDesc + pageWidth * 0.68;
    const colAmount = colDesc + pageWidth * 0.82;

    doc.rect(doc.page.margins.left, tableTop, pageWidth, 22).fill('#F6F9FC');

    doc.fillColor('#4A5D73').fontSize(9).font('Helvetica-Bold');
    doc.text('Description', colDesc + 8, tableTop + 7);
    doc.text('Qty', colQty, tableTop + 7, { width: 40, align: 'right' });
    doc.text('Unit Price', colUnit, tableTop + 7, { width: 70, align: 'right' });
    doc.text('Amount', colAmount, tableTop + 7, { width: 70, align: 'right' });

    let rowY = tableTop + 28;
    doc.font('Helvetica').fontSize(10).fillColor('#0A1628');

    for (const item of data.lineItems) {
      if (rowY > doc.page.height - 180) {
        doc.addPage();
        rowY = doc.page.margins.top;
      }

      doc.text(item.description, colDesc + 8, rowY, { width: pageWidth * 0.5 });
      doc.text(String(item.quantity), colQty, rowY, { width: 40, align: 'right' });
      doc.text(formatCents(item.unitPriceCents, data.invoice.currency), colUnit, rowY, { width: 70, align: 'right' });
      doc.text(formatCents(item.amountCents, data.invoice.currency), colAmount, rowY, { width: 70, align: 'right' });
      rowY += 22;
    }

    const totalsTop = Math.max(rowY + 16, tableTop + 28 + data.lineItems.length * 22 + 16);
    const labelX = colUnit;
    const valueX = colAmount;

    doc
      .moveTo(labelX - 20, totalsTop - 8)
      .lineTo(rightEdge, totalsTop - 8)
      .strokeColor('#D8E2ED')
      .stroke();

    doc.font('Helvetica').fontSize(10).fillColor('#4A5D73');
    doc.text('Subtotal', labelX, totalsTop, { width: 70, align: 'right' });
    doc.fillColor('#0A1628').text(formatCents(data.totalCents, data.invoice.currency), valueX, totalsTop, {
      width: 70,
      align: 'right',
    });

    doc.fillColor('#4A5D73').text('Paid', labelX, totalsTop + 20, { width: 70, align: 'right' });
    doc.fillColor('#047857').text(formatCents(data.paidCents, data.invoice.currency), valueX, totalsTop + 20, {
      width: 70,
      align: 'right',
    });

    doc.font('Helvetica-Bold').fillColor('#0A1628');
    doc.text('Balance Due', labelX, totalsTop + 44, { width: 70, align: 'right' });
    doc.text(formatCents(data.remainingCents, data.invoice.currency), valueX, totalsTop + 44, {
      width: 70,
      align: 'right',
    });

    doc
      .fillColor('#8B9CB0')
      .fontSize(8)
      .font('Helvetica')
      .text(
        `Generated by TMS Payment Ledger. Amounts in ${data.invoice.currency}.`,
        doc.page.margins.left,
        doc.page.height - 50,
        { width: pageWidth, align: 'center' }
      );

    doc.end();
  });
}
