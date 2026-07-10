import { generateInvoicePdf, invoicePdfFilename } from '../pdf/invoicePdf.js';
import { InvoiceService } from './InvoiceService.js';
import { VendorService } from './VendorService.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';

export class InvoicePdfService {
  private readonly invoices = new InvoiceService();
  private readonly vendors = new VendorService();
  private readonly payments = new PaymentRepository();

  async generatePdfBuffer(invoiceId: string): Promise<Buffer> {
    const invoice = this.invoices.getInvoice(invoiceId);
    const vendor = this.vendors.getVendor(invoice.vendorId);
    const lineItems = this.invoices.getLineItems(invoiceId);
    const totalCents = this.invoices.getInvoiceTotalCents(invoiceId);
    const paidCents = this.payments.getNetPaidCents(invoiceId);
    const remainingCents = this.invoices.getRemainingBalanceCents(invoiceId);

    return generateInvoicePdf({
      invoice,
      vendorName: vendor.name,
      vendorContact: vendor.contactInfo,
      lineItems,
      totalCents,
      paidCents,
      remainingCents,
    });
  }

  getDownloadFilename(invoiceId: string): string {
    const invoice = this.invoices.getInvoice(invoiceId);
    return invoicePdfFilename(invoice.invoiceNumber);
  }
}
