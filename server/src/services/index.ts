import { AccountService } from './AccountService.js';
import { AuthService } from './AuthService.js';
import { ComplianceReviewService } from './ComplianceReviewService.js';
import { InvoiceExtractionService } from './InvoiceExtractionService.js';
import { InvoiceService } from './InvoiceService.js';
import { LedgerAssistantService } from './LedgerAssistantService.js';
import { PaymentService } from './PaymentService.js';
import { SystemAccountService, VendorService } from './VendorService.js';

export const accountService = new AccountService();
export const authService = new AuthService();
export const complianceReviewService = new ComplianceReviewService();
export const invoiceExtractionService = new InvoiceExtractionService();
export const invoiceService = new InvoiceService();
export const ledgerAssistantService = new LedgerAssistantService();
export const paymentService = new PaymentService();
export const vendorService = new VendorService();
export const systemAccountService = new SystemAccountService();
