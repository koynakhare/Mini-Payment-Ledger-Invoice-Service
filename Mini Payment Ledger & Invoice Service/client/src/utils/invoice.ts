import startCase from 'lodash/startCase.js';
import type { InvoiceStatus } from '../types';

export function formatInvoiceStatus(status: InvoiceStatus): string {
  return startCase(status.replace(/_/g, ' '));
}
