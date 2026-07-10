import { AccountService } from './AccountService.js';
import { InvoiceService } from './InvoiceService.js';
import { PaymentService } from './PaymentService.js';
import { SystemAccountService, VendorService } from './VendorService.js';

export const accountService = new AccountService();
export const invoiceService = new InvoiceService();
export const paymentService = new PaymentService();
export const vendorService = new VendorService();
export const systemAccountService = new SystemAccountService();
